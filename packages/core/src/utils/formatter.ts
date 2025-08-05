export function formatUnits(value: number | bigint) {
  const units = new Map<number, string>([
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'K'],
  ])
  const numb = Number(value)

  for (const [threshold, unit] of units) {
    if (value >= threshold) {
      const formattedValue = (numb / threshold).toFixed(1)
      return `${formattedValue.replace(/\.0$/, '')}${unit}`
    }
  }

  return value.toString()
}
