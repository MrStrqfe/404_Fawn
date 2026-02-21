function getVisibleTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;

        const style = window.getComputedStyle(node.parentElement);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          !node.textContent.trim()
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

function findKeywordMatches(keyword) {
  const nodes = getVisibleTextNodes();
  const results = [];

  nodes.forEach((node) => {
    if (node.textContent.toLowerCase().includes(keyword.toLowerCase())) {
      const block = node.parentElement.closest("p, li, article, section, div");
      if (block && !results.includes(block)) {
        results.push(block);
      }
    }
  });

  return results;
}

function highlightElement(element) {
  document.querySelectorAll(".fawn-highlight").forEach((el) => {
    el.classList.remove("fawn-highlight");
  });

  element.classList.add("fawn-highlight");
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

const style = document.createElement("style");
style.textContent = `
.fawn-highlight {
  background-color: yellow !important;
  outline: 3px solid orange !important;
}
`;
document.head.appendChild(style);
