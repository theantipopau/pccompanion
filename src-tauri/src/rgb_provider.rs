use serde::Serialize;
use std::io::{ErrorKind, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::time::Duration;

const OPENRGB_ENDPOINT: &str = "127.0.0.1:6742";
const OPENRGB_MAX_PROTOCOL: u32 = 5;
const OPENRGB_CONNECT_TIMEOUT_MS: u64 = 450;
const OPENRGB_IO_TIMEOUT_MS: u64 = 650;
const MAX_CONTROLLERS_TO_PARSE: u32 = 32;
const MAX_PACKET_SIZE: u32 = 2 * 1024 * 1024;

const PACKET_REQUEST_CONTROLLER_COUNT: u32 = 0;
const PACKET_REQUEST_CONTROLLER_DATA: u32 = 1;
const PACKET_REQUEST_PROTOCOL_VERSION: u32 = 40;
const PACKET_SET_CLIENT_NAME: u32 = 50;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RgbDiscovery {
    pub provider: String,
    pub endpoint: String,
    pub state: String,
    pub protocol_version: Option<u32>,
    pub controller_count: usize,
    pub controllers: Vec<RgbControllerSummary>,
    pub message: String,
    pub write_safe: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RgbControllerSummary {
    pub index: u32,
    pub name: String,
    pub vendor: String,
    pub description: String,
    pub version: String,
    pub serial: String,
    pub location: String,
    pub controller_type: i32,
    pub active_mode: i32,
    pub modes: Vec<String>,
    pub zones: Vec<RgbZoneSummary>,
    pub led_count: usize,
    pub colors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RgbZoneSummary {
    pub name: String,
    pub zone_type: i32,
    pub led_count: u32,
    pub flags: Option<u32>,
}

pub fn discover_openrgb() -> RgbDiscovery {
    let endpoint = OPENRGB_ENDPOINT.to_string();
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 6742);
    let mut warnings = Vec::new();
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(OPENRGB_CONNECT_TIMEOUT_MS)) {
        Ok(stream) => stream,
        Err(err) => {
            return RgbDiscovery {
                provider: "OpenRGB".to_string(),
                endpoint,
                state: "unavailable".to_string(),
                protocol_version: None,
                controller_count: 0,
                controllers: Vec::new(),
                message: format!("OpenRGB SDK not detected on localhost: {err}"),
                write_safe: false,
                warnings: vec!["Phase 1 is read-only and does not start or bundle OpenRGB.".to_string()],
            };
        }
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(OPENRGB_IO_TIMEOUT_MS)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(OPENRGB_IO_TIMEOUT_MS)));
    let _ = send_packet(&mut stream, 0, PACKET_SET_CLIENT_NAME, b"Radium PCs Companion\0");

    let protocol_version = match negotiate_protocol(&mut stream) {
        Ok(version) => version.min(OPENRGB_MAX_PROTOCOL),
        Err(err) => {
            warnings.push(format!("Protocol negotiation fell back to v0: {err}"));
            0
        }
    };

    let controller_count = match request_controller_count(&mut stream) {
        Ok(count) => count,
        Err(err) => {
            return RgbDiscovery {
                provider: "OpenRGB".to_string(),
                endpoint,
                state: "degraded".to_string(),
                protocol_version: Some(protocol_version),
                controller_count: 0,
                controllers: Vec::new(),
                message: format!("OpenRGB SDK responded, but controller count failed: {err}"),
                write_safe: false,
                warnings,
            };
        }
    };

    let mut controllers = Vec::new();
    for index in 0..controller_count.min(MAX_CONTROLLERS_TO_PARSE) {
        match request_controller_data(&mut stream, index, protocol_version) {
            Ok(controller) => controllers.push(controller),
            Err(err) => warnings.push(format!("Controller {index} parse failed: {err}")),
        }
    }
    if controller_count > MAX_CONTROLLERS_TO_PARSE {
        warnings.push(format!("Controller list truncated to {MAX_CONTROLLERS_TO_PARSE} entries for UI safety."));
    }

    let state = if controllers.len() as u32 == controller_count.min(MAX_CONTROLLERS_TO_PARSE) {
        "live"
    } else if controllers.is_empty() && controller_count > 0 {
        "degraded"
    } else {
        "partial"
    };

    RgbDiscovery {
        provider: "OpenRGB".to_string(),
        endpoint,
        state: state.to_string(),
        protocol_version: Some(protocol_version),
        controller_count: controller_count as usize,
        controllers,
        message: format!("OpenRGB SDK detected with {controller_count} controller(s). Discovery is read-only."),
        write_safe: false,
        warnings,
    }
}

fn negotiate_protocol(stream: &mut TcpStream) -> Result<u32, String> {
    send_packet(stream, 0, PACKET_REQUEST_PROTOCOL_VERSION, &OPENRGB_MAX_PROTOCOL.to_le_bytes())?;
    match read_packet(stream) {
        Ok(packet) => {
            if packet.id != PACKET_REQUEST_PROTOCOL_VERSION || packet.payload.len() < 4 {
                return Err("unexpected protocol response".to_string());
            }
            Ok(u32::from_le_bytes(packet.payload[0..4].try_into().unwrap()))
        }
        Err(err) if err.contains("timed out") || err.contains("would block") => Ok(0),
        Err(err) => Err(err),
    }
}

fn request_controller_count(stream: &mut TcpStream) -> Result<u32, String> {
    send_packet(stream, 0, PACKET_REQUEST_CONTROLLER_COUNT, &[])?;
    let packet = read_packet(stream)?;
    if packet.id != PACKET_REQUEST_CONTROLLER_COUNT || packet.payload.len() < 4 {
        return Err("unexpected controller count response".to_string());
    }
    Ok(u32::from_le_bytes(packet.payload[0..4].try_into().unwrap()))
}

fn request_controller_data(stream: &mut TcpStream, index: u32, protocol_version: u32) -> Result<RgbControllerSummary, String> {
    let payload = if protocol_version == 0 {
        Vec::new()
    } else {
        protocol_version.to_le_bytes().to_vec()
    };
    send_packet(stream, index, PACKET_REQUEST_CONTROLLER_DATA, &payload)?;
    let packet = read_packet(stream)?;
    if packet.id != PACKET_REQUEST_CONTROLLER_DATA {
        return Err("unexpected controller data response".to_string());
    }
    parse_controller(index, protocol_version, &packet.payload)
}

fn send_packet(stream: &mut TcpStream, device_index: u32, packet_id: u32, payload: &[u8]) -> Result<(), String> {
    let mut packet = Vec::with_capacity(16 + payload.len());
    packet.extend_from_slice(b"ORGB");
    packet.extend_from_slice(&device_index.to_le_bytes());
    packet.extend_from_slice(&packet_id.to_le_bytes());
    packet.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    packet.extend_from_slice(payload);
    stream.write_all(&packet).map_err(|err| err.to_string())
}

struct NetPacket {
    id: u32,
    payload: Vec<u8>,
}

fn read_packet(stream: &mut TcpStream) -> Result<NetPacket, String> {
    let mut header = [0u8; 16];
    stream.read_exact(&mut header).map_err(io_error_to_string)?;
    if &header[0..4] != b"ORGB" {
        return Err("invalid OpenRGB packet magic".to_string());
    }
    let id = u32::from_le_bytes(header[8..12].try_into().unwrap());
    let size = u32::from_le_bytes(header[12..16].try_into().unwrap());
    if size > MAX_PACKET_SIZE {
        return Err(format!("OpenRGB packet too large: {size} bytes"));
    }
    let mut payload = vec![0u8; size as usize];
    if size > 0 {
        stream.read_exact(&mut payload).map_err(io_error_to_string)?;
    }
    Ok(NetPacket { id, payload })
}

fn io_error_to_string(err: std::io::Error) -> String {
    match err.kind() {
        ErrorKind::TimedOut => "timed out".to_string(),
        ErrorKind::WouldBlock => "would block".to_string(),
        _ => err.to_string(),
    }
}

fn parse_controller(index: u32, protocol_version: u32, payload: &[u8]) -> Result<RgbControllerSummary, String> {
    let mut cursor = ByteCursor::new(payload);
    let _data_size = cursor.read_u32()?;
    let controller_type = cursor.read_i32()?;
    let name = cursor.read_string()?;
    let vendor = if protocol_version >= 1 { cursor.read_string()? } else { String::new() };
    let description = cursor.read_string()?;
    let version = cursor.read_string()?;
    let serial = cursor.read_string()?;
    let location = cursor.read_string()?;
    let num_modes = cursor.read_u16()?;
    let active_mode = cursor.read_i32()?;
    let mut modes = Vec::new();
    for _ in 0..num_modes {
        let mode_name = cursor.read_string()?;
        if modes.len() < 8 {
            modes.push(mode_name);
        }
        let _mode_value = cursor.read_i32()?;
        let _mode_flags = cursor.read_u32()?;
        let _speed_min = cursor.read_u32()?;
        let _speed_max = cursor.read_u32()?;
        if protocol_version >= 3 {
            let _brightness_min = cursor.read_u32()?;
            let _brightness_max = cursor.read_u32()?;
        }
        let _colors_min = cursor.read_u32()?;
        let _colors_max = cursor.read_u32()?;
        let _speed = cursor.read_u32()?;
        if protocol_version >= 3 {
            let _brightness = cursor.read_u32()?;
        }
        let _direction = cursor.read_u32()?;
        let _color_mode = cursor.read_u32()?;
        let mode_num_colors = cursor.read_u16()?;
        cursor.skip(usize::from(mode_num_colors) * 4)?;
    }

    let num_zones = cursor.read_u16()?;
    let mut zones = Vec::new();
    for _ in 0..num_zones {
        let zone_name = cursor.read_string()?;
        let zone_type = cursor.read_i32()?;
        let _leds_min = cursor.read_u32()?;
        let _leds_max = cursor.read_u32()?;
        let led_count = cursor.read_u32()?;
        let matrix_len = cursor.read_u16()?;
        if matrix_len > 0 {
            cursor.skip(usize::from(matrix_len))?;
        }
        if protocol_version >= 4 {
            let num_segments = cursor.read_u16()?;
            for _ in 0..num_segments {
                let _segment_name = cursor.read_string()?;
                let _segment_type = cursor.read_i32()?;
                let _segment_start = cursor.read_u32()?;
                let _segment_leds = cursor.read_u32()?;
            }
        }
        let flags = if protocol_version >= 5 { Some(cursor.read_u32()?) } else { None };
        if zones.len() < 12 {
            zones.push(RgbZoneSummary { name: zone_name, zone_type, led_count, flags });
        }
    }

    let num_leds = cursor.read_u16()?;
    for _ in 0..num_leds {
        let _led_name = cursor.read_string()?;
        let _led_value = cursor.read_u32()?;
    }

    let num_colors = cursor.read_u16()?;
    let mut colors = Vec::new();
    for color_index in 0..num_colors {
        let value = cursor.read_u32()?;
        if color_index < 8 {
            colors.push(format_openrgb_color(value));
        }
    }

    if protocol_version >= 5 {
        let num_alt_names = cursor.read_u16()?;
        for _ in 0..num_alt_names {
            let _alt_name = cursor.read_string()?;
        }
        let _flags = cursor.read_u32()?;
    }

    Ok(RgbControllerSummary {
        index,
        name,
        vendor,
        description,
        version,
        serial,
        location,
        controller_type,
        active_mode,
        modes,
        zones,
        led_count: num_leds as usize,
        colors,
    })
}

fn format_openrgb_color(value: u32) -> String {
    let r = value & 0xFF;
    let g = (value >> 8) & 0xFF;
    let b = (value >> 16) & 0xFF;
    format!("#{r:02X}{g:02X}{b:02X}")
}

struct ByteCursor<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> ByteCursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn read_u16(&mut self) -> Result<u16, String> {
        let bytes = self.take(2)?;
        Ok(u16::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_u32(&mut self) -> Result<u32, String> {
        let bytes = self.take(4)?;
        Ok(u32::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_i32(&mut self) -> Result<i32, String> {
        let bytes = self.take(4)?;
        Ok(i32::from_le_bytes(bytes.try_into().unwrap()))
    }

    fn read_string(&mut self) -> Result<String, String> {
        let len = usize::from(self.read_u16()?);
        if len == 0 {
            return Ok(String::new());
        }
        let bytes = self.take(len)?;
        let trimmed = bytes.strip_suffix(&[0]).unwrap_or(bytes);
        Ok(String::from_utf8_lossy(trimmed).trim().to_string())
    }

    fn skip(&mut self, len: usize) -> Result<(), String> {
        let _ = self.take(len)?;
        Ok(())
    }

    fn take(&mut self, len: usize) -> Result<&'a [u8], String> {
        let end = self.pos.checked_add(len).ok_or_else(|| "OpenRGB packet cursor overflow".to_string())?;
        if end > self.data.len() {
            return Err("OpenRGB packet ended unexpectedly".to_string());
        }
        let slice = &self.data[self.pos..end];
        self.pos = end;
        Ok(slice)
    }
}
