export function buildDefaultEnvironmentDoc(
  environmentId: string,
  weatherId: string,
): Record<string, unknown> {
  return {
    $Comment: `Default environment created by TerraNova for ${environmentId}`,
    WeatherForecasts: [
      {
        Hour: 0,
        Weather: weatherId,
      },
    ],
    Tags: [],
    WaterTint: "#4a90d9",
    SpawnDensity: 1.0,
  };
}
