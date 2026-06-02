using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

const string provider = "radium-lhm-pawnio";

var result = new SensorSidecarResult
{
    Provider = provider,
    Available = false,
    DriverAvailable = false,
    Status = "initialising"
};

try
{
    string baseDir = AppContext.BaseDirectory;
    string libraryPath = Path.Combine(baseDir, "LibreHardwareMonitorLib.dll");

    if (!File.Exists(libraryPath))
    {
        result.Status = "missing_library";
        result.Notes.Add("LibreHardwareMonitorLib.dll is not bundled beside the sidecar yet.");
        Write(result);
        return;
    }

    Assembly assembly = Assembly.LoadFrom(libraryPath);
    result.LibraryVersion = assembly
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
        .InformationalVersion ?? assembly.GetName().Version?.ToString();
    Type? computerType = assembly.GetType("LibreHardwareMonitor.Hardware.Computer");
    if (computerType is null)
    {
        result.Status = "invalid_library";
        result.Notes.Add("LibreHardwareMonitor.Hardware.Computer type was not found.");
        Write(result);
        return;
    }

    object? computer = Activator.CreateInstance(computerType);
    if (computer is null)
    {
        result.Status = "create_failed";
        result.Notes.Add("Could not create LibreHardwareMonitor Computer instance.");
        Write(result);
        return;
    }

    SetBooleanProperty(computer, "IsCpuEnabled", true);
    SetBooleanProperty(computer, "IsMotherboardEnabled", true);
    SetBooleanProperty(computer, "IsControllerEnabled", true);
    SetBooleanProperty(computer, "IsStorageEnabled", true);

    InvokeNoArgs(computer, "Open");
    try
    {
        PropertyInfo? hardwareProperty = computerType.GetProperty("Hardware");
        object? hardwareItems = hardwareProperty?.GetValue(computer);
        if (hardwareItems is System.Collections.IEnumerable hardwareEnumerable)
        {
            foreach (object hardware in hardwareEnumerable)
            {
                VisitHardware(hardware, result);
            }
        }

        bool anyLowLevelSensor = result.CpuTempC is not null ||
            result.CpuFanRpm is not null ||
            result.StorageTempC is not null ||
            result.SeenTemperatureLabels.Count > 0;
        result.Available = result.CpuTempC is not null;
        result.DriverAvailable = anyLowLevelSensor;
        result.Status = result.CpuTempC is not null
            ? "live"
            : anyLowLevelSensor
                ? "partial_no_cpu_temp"
                : "no_matching_sensors";
        if (result.CpuTempC is null)
        {
            result.Notes.Add("LibreHardwareMonitor loaded, but no AMD CPU package temperature sensor was returned.");
            result.Notes.Add(result.SeenTemperatureLabels.Count > 0
                ? $"Temperature sensors seen: {string.Join(" | ", result.SeenTemperatureLabels.Take(10))}"
                : "No temperature sensors were exposed to the sidecar; PawnIO may be missing, blocked, or not started.");
        }
    }
    finally
    {
        InvokeNoArgs(computer, "Close");
    }
}
catch (ReflectionTypeLoadException ex)
{
    result.Status = "dependency_load_failed";
    result.Notes.Add(ex.Message);
    foreach (Exception? loaderException in ex.LoaderExceptions)
    {
        if (loaderException?.Message is { Length: > 0 } message)
        {
            result.Notes.Add(message);
        }
    }
}
catch (Exception ex)
{
    result.Status = "error";
    result.Notes.Add(ex.Message);
}

Write(result);

static void VisitHardware(object hardware, SensorSidecarResult result)
{
    InvokeNoArgs(hardware, "Update");

    string hardwareName = GetStringProperty(hardware, "Name");
    string hardwareType = GetStringProperty(hardware, "HardwareType");

    ReadSensors(hardware, hardwareName, hardwareType, result);

    object? subHardwareItems = hardware.GetType().GetProperty("SubHardware")?.GetValue(hardware);
    if (subHardwareItems is System.Collections.IEnumerable subHardwareEnumerable)
    {
        foreach (object subHardware in subHardwareEnumerable)
        {
            VisitHardware(subHardware, result);
        }
    }
}

static void ReadSensors(object hardware, string hardwareName, string hardwareType, SensorSidecarResult result)
{
    object? sensorItems = hardware.GetType().GetProperty("Sensors")?.GetValue(hardware);
    if (sensorItems is not System.Collections.IEnumerable sensorEnumerable)
    {
        return;
    }

    foreach (object sensor in sensorEnumerable)
    {
        string sensorName = GetStringProperty(sensor, "Name");
        string sensorType = GetStringProperty(sensor, "SensorType");
        float? value = GetNullableFloatProperty(sensor, "Value");
        if (value is null or <= 0)
        {
            continue;
        }

        string haystack = $"{hardwareType} {hardwareName} {sensorName}".ToLowerInvariant();

        if (sensorType.Equals("Temperature", StringComparison.OrdinalIgnoreCase))
        {
            RememberTemperatureLabel(result, hardwareName, sensorName, value.Value);
            if (LooksLikeCpuTemperature(haystack) && value is >= 0 and <= 125)
            {
                int score = CpuSensorScore(haystack);
                if (score > result.CpuTempScore)
                {
                    result.CpuTempScore = score;
                    result.CpuTempC = value;
                    result.CpuTempLabel = $"{hardwareName} / {sensorName}".Trim(' ', '/');
                }
            }
            else if (haystack.Contains("storage") || haystack.Contains("nvme") || haystack.Contains("ssd"))
            {
                result.StorageTempC = result.StorageTempC is null ? value : MathF.Max(result.StorageTempC.Value, value.Value);
            }
        }
        else if (sensorType.Equals("Fan", StringComparison.OrdinalIgnoreCase) && LooksLikeCpuFan(haystack))
        {
            uint rpm = (uint)MathF.Round(value.Value);
            if (rpm > 0)
            {
                result.CpuFanRpm = result.CpuFanRpm is null ? rpm : Math.Max(result.CpuFanRpm.Value, rpm);
            }
        }
    }
}

static bool LooksLikeCpuTemperature(string value)
{
    bool cpuHardware = value.Contains("cpu") ||
        value.Contains("amd") ||
        value.Contains("ryzen") ||
        value.Contains("processor");
    bool tempLabel = value.Contains("tctl") ||
        value.Contains("tdie") ||
        value.Contains("package") ||
        value.Contains("core") ||
        value.Contains("ccd");
    bool wrongDevice = value.Contains("gpu") ||
        value.Contains("battery") ||
        value.Contains("drive") ||
        value.Contains("ssd") ||
        value.Contains("nvme");
    return cpuHardware && tempLabel && !wrongDevice;
}

static void RememberTemperatureLabel(SensorSidecarResult result, string hardwareName, string sensorName, float value)
{
    if (result.SeenTemperatureLabels.Count >= 16)
    {
        return;
    }

    string label = $"{hardwareName} / {sensorName} {value:0.#}C".Trim(' ', '/');
    if (!result.SeenTemperatureLabels.Contains(label))
    {
        result.SeenTemperatureLabels.Add(label);
    }
}

static int CpuSensorScore(string value)
{
    if (value.Contains("tctl/tdie")) return 100;
    if (value.Contains("tdie")) return 92;
    if (value.Contains("tctl")) return 88;
    if (value.Contains("package")) return 82;
    if (value.Contains("ccd")) return 72;
    if (value.Contains("core")) return 62;
    return 1;
}

static bool LooksLikeCpuFan(string value)
{
    return (value.Contains("cpu") || value.Contains("processor")) && value.Contains("fan");
}

static void SetBooleanProperty(object target, string propertyName, bool value)
{
    PropertyInfo? property = target.GetType().GetProperty(propertyName);
    if (property?.CanWrite == true && property.PropertyType == typeof(bool))
    {
        property.SetValue(target, value);
    }
}

static void InvokeNoArgs(object target, string methodName)
{
    target.GetType().GetMethod(methodName, Type.EmptyTypes)?.Invoke(target, null);
}

static string GetStringProperty(object target, string propertyName)
{
    object? value = target.GetType().GetProperty(propertyName)?.GetValue(target);
    return value?.ToString() ?? string.Empty;
}

static float? GetNullableFloatProperty(object target, string propertyName)
{
    object? value = target.GetType().GetProperty(propertyName)?.GetValue(target);
    return value switch
    {
        float f => f,
        double d => (float)d,
        decimal d => (float)d,
        int i => i,
        uint i => i,
        _ => null
    };
}

static void Write(SensorSidecarResult result)
{
    result.CpuTempScore = 0;
    var options = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false
    };
    Console.WriteLine(JsonSerializer.Serialize(result, options));
}

sealed class SensorSidecarResult
{
    public string Provider { get; set; } = "";
    public bool Available { get; set; }
    public bool DriverAvailable { get; set; }
    public string Status { get; set; } = "";
    public string? LibraryVersion { get; set; }
    public float? CpuTempC { get; set; }
    public string? CpuTempLabel { get; set; }
    public uint? CpuFanRpm { get; set; }
    public float? StorageTempC { get; set; }
    public List<string> Notes { get; } = [];
    [JsonIgnore]
    public List<string> SeenTemperatureLabels { get; } = [];
    [JsonIgnore]
    public int CpuTempScore { get; set; }
}
