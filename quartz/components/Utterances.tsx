import { QuartzComponent, QuartzComponentConstructor } from "./types"

const Utterances: QuartzComponent = ({}) => {
  return <div id="utterances-container"></div>
}

Utterances.afterDOMLoaded = `
const userPref = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
const currentTheme = localStorage.getItem("theme") ?? userPref
const load = (theme) => {
  const script = document.createElement("script")
  const config = {
    src: "https://utteranc.es/client.js",
    repo: "observerw/obsidian-blog",
    "issue-term": "pathname",
    theme: "github-" + theme,
    crossorigin: "anonymous",
    async: true,
  }
  Object.entries(config).forEach(([key, value]) => {
    script.setAttribute(key, value)
  })

  const container = document.getElementById("utterances-container")
  while (container?.firstChild) {
    container.removeChild(container.firstChild)
  }
  container?.appendChild(script)
}

load(currentTheme)
document.addEventListener("themechange", (event) => {
  load(event.detail.theme)
})
`

export default (() => Utterances) satisfies QuartzComponentConstructor
