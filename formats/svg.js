import { escapeXml } from '../shared/xml.js';

export function buildMindmapSvg(tree, options = {}) {
  const interactive = options.interactive === true;
  const fontSize = 16;
  const nodeHeight = 36;
  const nodeRadius = 10;
  const toggleRadius = 10;
  const collapseDepth = 2;
  const horizontalGap = 84;
  const verticalGap = 18;
  const marginX = 28;
  const marginY = 28;
  const charWidth = 7.2;

  const nodes = [];
  const links = [];
  let maxX = 0;
  let nextNodeId = 0;

  function measureLabel(label) {
    const rightPadding = interactive ? 52 : 28;
    return Math.max(140, Math.ceil(label.length * charWidth) + rightPadding);
  }

  function layout(node, x, top, depth = 0, ancestorIds = []) {
    const id = `node-${nextNodeId += 1}`;
    const name = (node && node.name) || '';
    const width = measureLabel(name);
    const children = node.children || [];
    const childLayouts = [];
    let childrenHeight = 0;
    let cursor = top;

    for (const child of children) {
      const childLayout = layout(child, x + width + horizontalGap, cursor, depth + 1, [
        ...ancestorIds,
        id
      ]);
      childLayouts.push(childLayout);
      cursor += childLayout.height + verticalGap;
      childrenHeight += childLayout.height;
    }

    if (childLayouts.length > 1) {
      childrenHeight += verticalGap * (childLayouts.length - 1);
    }

    const hasChildren = childLayouts.length > 0;
    const collapsed = interactive && depth >= collapseDepth && hasChildren;
    const subtreeHeight = collapsed
      ? nodeHeight
      : Math.max(nodeHeight, childrenHeight);
    const centerY = top + (subtreeHeight / 2);
    const y = centerY - (nodeHeight / 2);
    const current = {
      id,
      name,
      x,
      y,
      width,
      height: nodeHeight,
      depth,
      hasChildren,
      collapsed,
      ancestorIds: ancestorIds.join(' ')
    };

    nodes.push(current);
    maxX = Math.max(maxX, x + width);

    for (const childLayout of childLayouts) {
      links.push({
        x1: x + width,
        y1: centerY,
        x2: childLayout.node.x,
        y2: childLayout.node.y + (childLayout.node.height / 2),
        childId: childLayout.node.id,
        ancestorIds: childLayout.node.ancestorIds
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
    const childAttr = interactive
      ? ` data-child="${link.childId}"`
      : '';
    const ancestorAttrs = interactive && link.ancestorIds
      ? ` data-ancestors="${link.ancestorIds}"`
      : '';
    return `<path class="link" d="M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}"${childAttr}${ancestorAttrs} />`;
  }).join('');

  const nodeMarkup = nodes.map(node => {
    const textX = node.x + 14;
    const textY = node.y + (node.height / 2);
    const toggleX = node.x + node.width - 18;
    const toggleY = node.y + (node.height / 2);
    const ancestorAttrs = interactive && node.ancestorIds
      ? ` data-ancestors="${node.ancestorIds}"`
      : '';
    const collapsedAttr = interactive
      ? ` data-collapsed="${node.collapsed ? 'true' : 'false'}"`
      : '';
    const idAttr = interactive ? ` id="${node.id}"` : '';
    const toggleMarkup = interactive && node.hasChildren
      ? `<circle class="toggle-hitbox" cx="${toggleX}" cy="${toggleY}" r="${toggleRadius}" onclick="toggleNode(this.ownerSVGElement, '${node.id}')" /><text x="${toggleX}" y="${toggleY}" class="toggle-symbol">${node.collapsed ? '&gt;' : '&lt;'}</text>`
      : '';

    return `<g class="node"${idAttr}${collapsedAttr}${ancestorAttrs}><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${nodeRadius}" ry="${nodeRadius}" />${toggleMarkup}<text x="${textX}" y="${textY}" class="node-name">${escapeXml(node.name)}</text></g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Mindmap export"${interactive ? ' onload="initMindmap(this)"' : ''}>
  <style>
    .link { fill: none; stroke: #7c8aa5; stroke-width: 2; }
    .node rect { fill: #ffffff; stroke: #4f8cff; stroke-width: 1.5; }
    .node-name { fill: #18212f; font: ${fontSize}px Arial, sans-serif; dominant-baseline: middle; }
    .toggle-hitbox { fill: #e8f0ff; stroke: #4f8cff; stroke-width: 1.5; cursor: pointer; }
    .toggle-symbol { fill: #4f8cff; font: 700 14px Arial, sans-serif; text-anchor: middle; dominant-baseline: middle; pointer-events: none; user-select: none; }
  </style>
  ${interactive ? `<script><![CDATA[
    const horizontalGap = 84;
    const verticalGap = 18;
    const marginX = 28;
    const marginY = 28;
    const nodeHeight = 36;
    const toggleInset = 18;
    const animationDuration = 140;

    function splitAncestors(value) {
      return (value || '').split(/\\s+/).filter(Boolean);
    }

    function getParentId(node) {
      const ancestors = splitAncestors(node.getAttribute('data-ancestors'));
      return ancestors[ancestors.length - 1] || '';
    }

    function collectTree(svg) {
      const nodes = new Map();
      Array.from(svg.querySelectorAll('g.node[id]')).forEach(element => {
        const rect = element.querySelector('rect');
        nodes.set(element.id, {
          id: element.id,
          width: Number(rect.getAttribute('width')),
          collapsed: element.getAttribute('data-collapsed') === 'true',
          parentId: getParentId(element),
          children: []
        });
      });

      let root = null;
      nodes.forEach(node => {
        if (node.parentId) {
          nodes.get(node.parentId)?.children.push(node);
        } else {
          root = node;
        }
      });

      return { root };
    }

    function layoutTree(root) {
      const nodeLayouts = new Map();
      const linkLayouts = new Map();

      function layout(node, x, top, visible = true) {
        const childLayouts = [];
        let childrenHeight = 0;
        let cursor = top;

        node.children.forEach(child => {
          const childLayout = layout(
            child,
            x + node.width + horizontalGap,
            cursor,
            visible && !node.collapsed
          );
          childLayouts.push(childLayout);
          cursor += childLayout.height + verticalGap;
          childrenHeight += childLayout.height;
        });

        if (childLayouts.length > 1) {
          childrenHeight += verticalGap * (childLayouts.length - 1);
        }

        const subtreeHeight = node.collapsed || childLayouts.length === 0
          ? nodeHeight
          : Math.max(nodeHeight, childrenHeight);
        const centerY = top + (subtreeHeight / 2);
        const y = centerY - (nodeHeight / 2);

        nodeLayouts.set(node.id, {
          x,
          y,
          width: node.width,
          visible,
          collapsed: node.collapsed,
          parentId: node.parentId,
          hasChildren: node.children.length > 0
        });

        childLayouts.forEach(childLayout => {
          linkLayouts.set(childLayout.id, {
            parentId: node.id,
            childId: childLayout.id,
            visible: visible && !node.collapsed
          });
        });

        return {
          id: node.id,
          x,
          y,
          height: subtreeHeight
        };
      }

      const rootLayout = layout(root, marginX, marginY, true);
      return {
        nodes: nodeLayouts,
        links: linkLayouts,
        totalHeight: rootLayout.height + (marginY * 2)
      };
    }

    function applyNodeLayout(element, layout) {
      const rect = element.querySelector('rect');
      rect.setAttribute('x', String(layout.x));
      rect.setAttribute('y', String(layout.y));

      const text = element.querySelector('.node-name');
      text.setAttribute('x', String(layout.x + 14));
      text.setAttribute('y', String(layout.y + (nodeHeight / 2)));

      const toggleHitbox = element.querySelector('.toggle-hitbox');
      const toggleSymbol = element.querySelector('.toggle-symbol');
      if (toggleHitbox && toggleSymbol) {
        const toggleX = layout.x + layout.width - toggleInset;
        const toggleY = layout.y + (nodeHeight / 2);
        toggleHitbox.setAttribute('cx', String(toggleX));
        toggleHitbox.setAttribute('cy', String(toggleY));
        toggleSymbol.setAttribute('x', String(toggleX));
        toggleSymbol.setAttribute('y', String(toggleY));
        toggleSymbol.textContent = layout.collapsed ? '>' : '<';
      }

      element.style.display = layout.visible ? '' : 'none';
    }

    function getTogglePoint(layout) {
      return {
        x: layout.x + layout.width - toggleInset,
        y: layout.y + (nodeHeight / 2)
      };
    }

    function applyLinkLayout(element, parentLayout, childLayout, visible) {
      const parentPoint = getTogglePoint(parentLayout);
      const childX = childLayout.x;
      const childY = childLayout.y + (nodeHeight / 2);
      const dx = Math.max(0, (childX - parentPoint.x) / 2);
      element.setAttribute(
        'd',
        'M ' + parentPoint.x + ' ' + parentPoint.y
          + ' C ' + (parentPoint.x + dx) + ' ' + parentPoint.y
          + ', ' + (childX - dx) + ' ' + childY
          + ', ' + childX + ' ' + childY
      );
      element.style.display = visible ? '' : 'none';
    }

    function setSvgHeight(svg, totalHeight) {
      const svgWidth = Number(svg.getAttribute('width'));
      svg.setAttribute('height', String(totalHeight));
      svg.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + totalHeight);
    }

    function setAnimating(svg, animating) {
      svg.setAttribute('data-animating', animating ? 'true' : 'false');
    }

    function isAnimating(svg) {
      return svg.getAttribute('data-animating') === 'true';
    }

    function clearNodeTransition(element) {
      element.style.transition = '';
      element.style.opacity = '';
      element.style.transform = '';
    }

    function clearLinkTransition(element) {
      element.style.transition = '';
      element.style.opacity = '';
    }

    function buildSnapshot(svg) {
      const { root } = collectTree(svg);
      return root ? layoutTree(root) : null;
    }

    function applySnapshot(svg, snapshot) {
      setSvgHeight(svg, snapshot.totalHeight);

      snapshot.nodes.forEach((layout, nodeId) => {
        const element = svg.querySelector('g.node[id="' + nodeId + '"]');
        if (element) {
          applyNodeLayout(element, layout);
        }
      });

      snapshot.links.forEach((layout, childId) => {
        const element = svg.querySelector('path.link[data-child="' + childId + '"]');
        const parentLayout = snapshot.nodes.get(layout.parentId);
        const childLayout = snapshot.nodes.get(layout.childId);
        if (element && parentLayout && childLayout) {
          applyLinkLayout(element, parentLayout, childLayout, layout.visible);
        }
      });
    }

    function relayout(svg) {
      const snapshot = buildSnapshot(svg);
      if (snapshot) {
        applySnapshot(svg, snapshot);
      }
    }

    function cloneLayout(layout) {
      return {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        collapsed: layout.collapsed,
        parentId: layout.parentId,
        hasChildren: layout.hasChildren,
        visible: true
      };
    }

    function createAnchorLayout(point, layout) {
      return {
        x: point.x,
        y: point.y - (nodeHeight / 2),
        width: layout.width,
        collapsed: layout.collapsed,
        parentId: layout.parentId,
        hasChildren: layout.hasChildren,
        visible: true
      };
    }

    function lerp(start, end, t) {
      return start + ((end - start) * t);
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function buildNodeTransitions(before, after, toggledNodeId) {
      const transitions = new Map();
      const nodeIds = Array.from(new Set([
        ...before.nodes.keys(),
        ...after.nodes.keys()
      ]));
      const toggledLayout = before.nodes.get(toggledNodeId) || after.nodes.get(toggledNodeId);
      const fallbackOrigin = getTogglePoint(toggledLayout);

      nodeIds.forEach(nodeId => {
        const beforeLayout = before.nodes.get(nodeId);
        const afterLayout = after.nodes.get(nodeId);
        const beforeVisible = Boolean(beforeLayout && beforeLayout.visible);
        const afterVisible = Boolean(afterLayout && afterLayout.visible);

        if (!beforeVisible && !afterVisible) {
          return;
        }

        transitions.set(nodeId, {
          nodeId,
          beforeLayout,
          afterLayout,
          beforeVisible,
          afterVisible,
          start: null,
          end: null
        });
      });

      function resolveStart(nodeId) {
        const transition = transitions.get(nodeId);
        if (!transition) {
          return null;
        }
        if (transition.start) {
          return transition.start;
        }
        if (transition.beforeVisible) {
          transition.start = cloneLayout(transition.beforeLayout);
          return transition.start;
        }

        const parentId = transition.afterLayout.parentId;
        const parentTransition = transitions.get(parentId);
        const parentLayout = parentTransition
          ? resolveStart(parentId)
          : null;
        const origin = parentLayout
          ? getTogglePoint(parentLayout)
          : fallbackOrigin;

        transition.start = createAnchorLayout(origin, transition.afterLayout);
        return transition.start;
      }

      function resolveEnd(nodeId) {
        const transition = transitions.get(nodeId);
        if (!transition) {
          return null;
        }
        if (transition.end) {
          return transition.end;
        }
        if (transition.afterVisible) {
          transition.end = cloneLayout(transition.afterLayout);
          return transition.end;
        }

        const parentId = transition.beforeLayout.parentId;
        const parentTransition = transitions.get(parentId);
        const parentLayout = parentTransition
          ? resolveEnd(parentId)
          : null;
        const origin = parentLayout
          ? getTogglePoint(parentLayout)
          : fallbackOrigin;

        transition.end = createAnchorLayout(origin, transition.beforeLayout);
        return transition.end;
      }

      transitions.forEach((transition, nodeId) => {
        transition.start = resolveStart(nodeId);
        transition.end = resolveEnd(nodeId);
      });

      return transitions;
    }

    function interpolateNodeLayout(transition, t) {
      return {
        x: lerp(transition.start.x, transition.end.x, t),
        y: lerp(transition.start.y, transition.end.y, t),
        width: transition.end.width,
        collapsed: transition.end.collapsed,
        parentId: transition.end.parentId,
        hasChildren: transition.end.hasChildren,
        visible: true
      };
    }

    function animateRelayout(svg, before, after, toggledNodeId) {
      const nodeTransitions = buildNodeTransitions(before, after, toggledNodeId);
      const linkIds = Array.from(new Set([
        ...before.links.keys(),
        ...after.links.keys()
      ]));
      const startTime = performance.now();

      setAnimating(svg, true);
      function renderFrame(progress) {
        const t = easeOutCubic(progress);
        const currentHeight = lerp(before.totalHeight, after.totalHeight, t);
        const currentLayouts = new Map();

        setSvgHeight(svg, currentHeight);

        nodeTransitions.forEach((transition, nodeId) => {
          const element = svg.querySelector('g.node[id="' + nodeId + '"]');
          if (!element) {
            return;
          }

          clearNodeTransition(element);

          const layout = interpolateNodeLayout(transition, t);
          const opacity = lerp(
            transition.beforeVisible ? 1 : 0,
            transition.afterVisible ? 1 : 0,
            t
          );

          currentLayouts.set(nodeId, layout);
          applyNodeLayout(element, layout);
          element.style.opacity = String(opacity);
        });

        linkIds.forEach(childId => {
          const element = svg.querySelector('path.link[data-child="' + childId + '"]');
          if (!element) {
            return;
          }

          clearLinkTransition(element);

          const beforeLink = before.links.get(childId);
          const afterLink = after.links.get(childId);
          const link = afterLink || beforeLink;

          if (!link) {
            element.style.display = 'none';
            return;
          }

          const parentLayout = currentLayouts.get(link.parentId);
          const childLayout = currentLayouts.get(link.childId);
          const beforeVisible = Boolean(beforeLink && beforeLink.visible);
          const afterVisible = Boolean(afterLink && afterLink.visible);

          if (!parentLayout || !childLayout || (!beforeVisible && !afterVisible)) {
            element.style.display = 'none';
            return;
          }

          applyLinkLayout(element, parentLayout, childLayout, true);
          element.style.opacity = String(lerp(
            beforeVisible ? 1 : 0,
            afterVisible ? 1 : 0,
            t
          ));
        });
      }

      function finish() {
        applySnapshot(svg, after);

        nodeTransitions.forEach((_, nodeId) => {
          const element = svg.querySelector('g.node[id="' + nodeId + '"]');
          if (element) {
            clearNodeTransition(element);
          }
        });

        linkIds.forEach(childId => {
          const element = svg.querySelector('path.link[data-child="' + childId + '"]');
          if (element) {
            clearLinkTransition(element);
          }
        });

        setAnimating(svg, false);
      }

      function tick(now) {
        const progress = Math.min(1, (now - startTime) / animationDuration);
        renderFrame(progress);

        if (progress < 1) {
          requestAnimationFrame(tick);
          return;
        }

        finish();
      }

      requestAnimationFrame(tick);
    }

    function collapseDescendants(svg, nodeId) {
      svg.querySelectorAll('g.node[data-ancestors~="' + nodeId + '"]').forEach(descendant => {
        if (descendant.querySelector('.toggle-symbol')) {
          descendant.setAttribute('data-collapsed', 'true');
        }
      });
    }

    function initMindmap(svg) {
      setAnimating(svg, false);
      relayout(svg);
    }

    function toggleNode(svg, nodeId) {
      if (isAnimating(svg)) {
        return;
      }

      const node = svg.querySelector('g.node[id="' + nodeId + '"]');
      if (!node) {
        return;
      }

      const before = buildSnapshot(svg);
      if (!before) {
        return;
      }

      const collapsed = node.getAttribute('data-collapsed') === 'true';
      if (collapsed) {
        node.setAttribute('data-collapsed', 'false');
      } else {
        node.setAttribute('data-collapsed', 'true');
        collapseDescendants(svg, nodeId);
      }

      const after = buildSnapshot(svg);
      if (!after) {
        return;
      }

      animateRelayout(svg, before, after, nodeId);
    }
  ]]></script>` : ''}
  ${linkMarkup}
  ${nodeMarkup}
</svg>`;
}
