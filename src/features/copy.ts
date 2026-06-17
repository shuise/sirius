import { register } from "../common/feature-manager"

/**
 * Feature 4: 移除复制屏蔽
 */
function removeCopyBlocker() {
  const style = document.createElement("style")
  style.id = "sirius-copy-style"
  style.textContent = `
    body, body * {
      -webkit-user-select: text !important;
      user-select: text !important;
    }
  `
  document.head.appendChild(style)

  document.addEventListener(
    "copy",
    (e) => {
      e.stopPropagation()
    },
    true,
  )

  document.addEventListener(
    "cut",
    (e) => {
      e.stopPropagation()
    },
    true,
  )

  document.addEventListener(
    "contextmenu",
    (e) => {
      e.stopPropagation()
    },
    true,
  )
}

register({
  name: "copy",
  defaultEnabled: true,
  init() {
    removeCopyBlocker()
  },
  destroy() {
    const s = document.getElementById("sirius-copy-style")
    if (s) s.remove()
  },
})
