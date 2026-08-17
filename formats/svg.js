import { escapeXml } from '../shared/xml.js';

export function buildMindmapSvg(tree) {
  // Build a simple static SVG from the tree so we do not depend on
  // NotebookLM's cross-origin mindmap iframe internals.
  const fontSize = 16;
  const nodeHeight = 36;
  const nodeRadius = 10;
  const horizontalGap = 84;
  const verticalGap = 18;
  const marginX = 28;
  const marginY = 28;
  const charWidth = 7.2;

  const nodes = [];
  const links = [];
  let maxX = 0;

  function measureLabel(label) {
    return Math.max(140, Math.ceil(label.length * charWidth) + 28);
  }

  function layout(node, x, top) {
    const name = (node && node.name) || '';
    const width = measureLabel(name);
    const children = node.children || [];
    const childLayouts = [];
    let childrenHeight = 0;
    let cursor = top;

    for (const child of children) {
      // Each generation starts to the right of the parent's right edge.
      const childLayout = layout(child, x + width + horizontalGap, cursor);
      childLayouts.push(childLayout);
      cursor += childLayout.height + verticalGap;
      childrenHeight += childLayout.height;
    }

    if (childLayouts.length > 1) {
      childrenHeight += verticalGap * (childLayouts.length - 1);
    }

    const subtreeHeight = Math.max(nodeHeight, childrenHeight);
    const centerY = top + (subtreeHeight / 2);
    const y = centerY - (nodeHeight / 2);
    const current = { name: node.name, x, y, width, height: nodeHeight };

    nodes.push(current);
    maxX = Math.max(maxX, x + width);

    for (const childLayout of childLayouts) {
      links.push({
        x1: x + width,
        y1: centerY,
        x2: childLayout.node.x,
        y2: childLayout.node.y + (childLayout.node.height / 2)
      });
    }

    return {
      node: current,
      height: subtreeHeight
    };
  }

  const rootLayout = layout(tree, marginX, marginY);
  const totalHeight = rootLayout.height + marginY * 2;
  const totalWidth = maxX + marginX;

  const linkMarkup = links.map(link => {
    const dx = Math.max(24, (link.x2 - link.x1) / 2);
    return `<path class="link" d="M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}" />`;
  }).join('');

  const nodeMarkup = nodes.map(node => {
    const textX = node.x + 14;
    const textY = node.y + (node.height / 2);
    return `<g class="node"><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${nodeRadius}" ry="${nodeRadius}" /><text x="${textX}" y="${textY}" class="node-name">${escapeXml(node.name)}</text></g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Mindmap export">
  <style>
    .link { fill: none; stroke: #7c8aa5; stroke-width: 2; }
    .node rect { fill: #ffffff; stroke: #4f8cff; stroke-width: 1.5; }
    .node-name { fill: #18212f; font: ${fontSize}px Arial, sans-serif; dominant-baseline: middle; }
  </style>
  ${linkMarkup}
  ${nodeMarkup}
</svg>`;
}
