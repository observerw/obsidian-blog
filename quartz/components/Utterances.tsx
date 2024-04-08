import { QuartzComponent, QuartzComponentConstructor } from "./types"

const Utterances: QuartzComponent = ({}) => {
  return (
    <script
      id="utterances"
      src="https://utteranc.es/client.js"
      repo="observerw/obsidian-blog"
      issue-term="pathname"
      theme="github-light"
      crossorigin="anonymous"
      async
    ></script>
  )
}

export default (() => Utterances) satisfies QuartzComponentConstructor
