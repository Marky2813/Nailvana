export function rgbaToSaturation(red: number, green: number, blue: number) {
  const normalizedRed = red / 255
  const normalizedGreen = green / 255
  const normalizedBlue = blue / 255
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
  const delta = max - min

  return max === 0 ? 0 : delta / max
}

export function averageSaturationFromPixelData(data: Uint8ClampedArray) {
  let saturationTotal = 0
  let pixelCount = 0

  for (let index = 0; index < data.length; index += 4) {
    saturationTotal += rgbaToSaturation(data[index], data[index + 1], data[index + 2])
    pixelCount += 1
  }

  if (pixelCount === 0) {
    return null
  }

  return saturationTotal / pixelCount
}

export function averageNumbers(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}
