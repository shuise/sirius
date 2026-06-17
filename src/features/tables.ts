import { register } from "../common/feature-manager"

/**
 * Feature 3: 表格 ↔ 图表双向转换
 */

let chartContainers: HTMLElement[] = []

interface ChartValue {
  label: string
  value: number
}

function renderBarChart(table: HTMLTableElement, container: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr"))
  if (rows.length < 2) return

  const dataRows = rows.slice(1).map((row) =>
    Array.from(row.querySelectorAll("td")).map((td) => td.textContent?.trim() || ""),
  )
  if (dataRows.length === 0 || dataRows[0].length < 2) return

  const values: ChartValue[] = dataRows.map((row) => {
    const val = parseFloat(row[row.length - 2])
    return { label: row[row.length - 1], value: isNaN(val) ? 0 : val }
  })
  if (values.length === 0) return

  const maxVal = Math.max(...values.map((v) => v.value))
  if (maxVal === 0) return

  const width = Math.max(300, values.length * 60)
  const height = 220
  const barWidth = Math.min(40, (width - 40) / values.length - 8)
  const pad = { top: 10, right: 10, bottom: 40, left: 40 }

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:8px 0;background:#fafafa;border-radius:6px;">`

  for (let i = 0; i <= 4; i++) {
    const yVal = (maxVal / 4) * i
    const y = pad.top + (height - pad.top - pad.bottom) * (1 - i / 4)
    svg += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`
    svg += `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${Math.round(yVal)}</text>`
  }

  values.forEach((v, i) => {
    const barH = (v.value / maxVal) * (height - pad.top - pad.bottom)
    const x = pad.left + ((width - pad.left - pad.right) / values.length) * i + 8
    const y = height - pad.bottom - barH
    const color = `hsl(${(i * 60) % 360}, 60%, 55%)`

    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="3">
              <title>${v.label}: ${v.value}</title>
            </rect>`
    svg += `<text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#333">${v.label}</text>`
  })

  svg += "</svg>"
  container.innerHTML = svg
}

function addToggleToTable(table: HTMLTableElement) {
  if (table.dataset.siriusProcessed) return
  table.dataset.siriusProcessed = "true"

  const wrapper = document.createElement("div")
  wrapper.style.cssText = "position:relative;margin:12px 0;"

  const toggleBar = document.createElement("div")
  toggleBar.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:4px 8px;background:#eef2ff;border-radius:6px 6px 0 0;font-size:12px;"

  const btn = document.createElement("button")
  btn.textContent = "📊 转为图表"
  btn.style.cssText =
    "border:1px solid #6366f1;background:#fff;color:#6366f1;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:12px;"

  const label = document.createElement("span")
  label.textContent = "Table"

  let chartContainer: HTMLElement | null = null
  let showChart = false

  btn.addEventListener("click", () => {
    showChart = !showChart
    if (showChart) {
      if (!chartContainer) {
        chartContainer = document.createElement("div")
        wrapper.insertBefore(chartContainer, table.nextSibling)
        renderBarChart(table, chartContainer)
        chartContainers.push(chartContainer)
      }
      chartContainer.style.display = "block"
      table.style.display = "none"
      btn.textContent = "📋 转为表格"
      label.textContent = "Chart"
    } else {
      chartContainer!.style.display = "none"
      table.style.display = ""
      btn.textContent = "📊 转为图表"
      label.textContent = "Table"
    }
  })

  toggleBar.appendChild(btn)
  toggleBar.appendChild(label)

  table.parentNode!.insertBefore(wrapper, table)
  wrapper.appendChild(toggleBar)
  wrapper.appendChild(table)
}

function processTables() {
  const tables = document.querySelectorAll("table")
  tables.forEach((table) => addToggleToTable(table))
}

register({
  name: "tables",
  defaultEnabled: true,
  init() {
    processTables()
  },
  destroy() {
    chartContainers.forEach((c) => c.remove())
    chartContainers = []
    document.querySelectorAll("table[data-sirius-processed]").forEach((table) => {
      const wrapper = table.closest("div[style]") as HTMLElement | null
      if (wrapper) {
        ;(table as HTMLElement).style.display = ""
        wrapper.parentNode!.insertBefore(table, wrapper)
        wrapper.remove()
      }
      delete (table as HTMLElement).dataset.siriusProcessed
    })
  },
})
