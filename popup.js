import { buildMindmapSvg } from './formats/svg.js';
import { escapeXml } from './shared/xml.js';

function getExportFilename(ext, rootName) {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `notebookllm-${rootName}-${timeStr}.${ext}`;
}

function sanitizeRootName(name) {
  const cleaned = (name || 'unknown')
    .trim()
    .replace(/:/g, ' -')
    .replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'unknown';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getHeadingDepthLimit() {
  const input = document.getElementById('headingDepthLimit');
  const value = Number.parseInt(input?.value || '2', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 6) : 2;
}

function getInteractiveSvgEnabled() {
  const input = document.getElementById('interactiveSvg');
  return Boolean(input?.checked);
}

/**
 * Provider-agnostic tree consumed by the Markdown and SVG exporters.
 *
 * @typedef {Object} MindmapNode
 * @property {string} name
 * @property {MindmapNode[]} children
 */

/**
 * @typedef {{ mindmap: MindmapNode } | { error: string }} MindmapLoadResult
 */

const { adaptNotebookLmPayload: adaptMindmapPayload } = globalThis.MindmapContract || {};

if (typeof adaptMindmapPayload !== 'function') {
  throw new Error('MindmapContract.adaptNotebookLmPayload is not available');
}

/**
 * @param {MindmapNode} tree
 * @param {number} headingDepthLimit
 */
function buildMarkdown(tree, headingDepthLimit) {
  const lines = [];
  let total = 0;

  // Markdown structure:
  // - nodes up to headingDepthLimit -> headings
  // - deeper nodes -> nested bullet points
  function visit(node, depth = 0) {
    if (!node || !node.name) {
      return;
    }

    total += 1;

    if (depth < headingDepthLimit) {
      if (depth > 0 && lines.length > 0) {
        lines.push('');
      }
      lines.push(`${'#'.repeat(depth + 1)} ${node.name}`);
    } else {
      const indent = '  '.repeat(depth - headingDepthLimit);
      lines.push(`${indent}- ${node.name}`);
    }

    for (const child of node.children || []) {
      visit(child, depth + 1);
    }
  }

  visit(tree);

  return {
    markdown: lines.join('\n'),
    stats: {
      total,
      normal: total,
      missing: 0,
      missingNames: []
    }
  };
}

/**
 * @param {MindmapNode} tree
 */
function buildFreePlane(tree) {
  let nextId = 1;

  function createNodeId() {
    const id = `ID_${nextId}`;
    nextId += 1;
    return id;
  }

  function buildNode(node, depth = 0) {
    const indent = '  '.repeat(depth + 1);
    const attributes = [
      `TEXT="${escapeXml(node.name || 'unknown')}"`,
      `ID="${createNodeId()}"`
    ];

    if (depth === 0) {
      attributes.push('STYLE="oval"');
    }

    // FreePlane uses POSITION only for direct children of the root.
    if (depth === 1) {
      attributes.push('POSITION="right"');
    }

    const children = node.children || [];
    if (depth > 0 && children.length === 0) {
      return `${indent}<node ${attributes.join(' ')} />`;
    }

    const lines = [`${indent}<node ${attributes.join(' ')}>`];

    if (depth === 0) {
      lines.push(`${indent}  <hook NAME="MapStyle">`);
      lines.push(`${indent}    <properties edgeColorConfiguration="#808080ff,#ff0000ff,#0000ffff,#00ff00ff,#ff00ffff,#00ffffff,#7c0000ff,#00007cff,#007c00ff,#7c007cff,#007c7cff,#7c7c00ff"/>`);
      lines.push(`${indent}    <map_styles>`);
      lines.push(`${indent}      <stylenode LOCALIZED_TEXT="styles.root_node" STYLE="oval" SHAPE_VERTICAL_MARGIN="12.0 pt" SHAPE_HORIZONTAL_MARGIN="6.0 pt">`);
      lines.push(`${indent}        <stylenode LOCALIZED_TEXT="styles.predefined" POSITION="right">`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="default" COLOR="#000000" STYLE="fork" ICON_SIZE="12.0 pt">`);
      lines.push(`${indent}            <font NAME="SansSerif" SIZE="10" BOLD="false" ITALIC="false"/>`);
      lines.push(`${indent}          </stylenode>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="defaultstyle.details"/>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="defaultstyle.note" COLOR="#000000" BACKGROUND_COLOR="#ffffff" TEXT_ALIGN="LEFT"/>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="defaultstyle.floating">`);
      lines.push(`${indent}            <edge STYLE="hide_edge"/>`);
      lines.push(`${indent}            <cloud COLOR="#f0f0f0" SHAPE="ROUND_RECT"/>`);
      lines.push(`${indent}          </stylenode>`);
      lines.push(`${indent}        </stylenode>`);
      lines.push(`${indent}        <stylenode LOCALIZED_TEXT="styles.AutomaticLayout" POSITION="right">`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="AutomaticLayout.level.root" COLOR="#000000" STYLE="oval" SHAPE_VERTICAL_MARGIN="10.0 pt" SHAPE_HORIZONTAL_MARGIN="10.0 pt">`);
      lines.push(`${indent}            <font SIZE="18"/>`);
      lines.push(`${indent}          </stylenode>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="AutomaticLayout.level,1" COLOR="#0033ff"><font SIZE="16"/></stylenode>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="AutomaticLayout.level,2" COLOR="#00b439"><font SIZE="14"/></stylenode>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="AutomaticLayout.level,3" COLOR="#990000"><font SIZE="12"/></stylenode>`);
      lines.push(`${indent}          <stylenode LOCALIZED_TEXT="AutomaticLayout.level,4" COLOR="#111111"><font SIZE="10"/></stylenode>`);
      lines.push(`${indent}        </stylenode>`);
      lines.push(`${indent}      </stylenode>`);
      lines.push(`${indent}    </map_styles>`);
      lines.push(`${indent}  </hook>`);
      lines.push(`${indent}  <hook NAME="AutomaticEdgeColor" COUNTER="0" RULE="ON_BRANCH_CREATION"/>`);
    }

    if (children.length > 0) {
      lines.push(children.map(child => buildNode(child, depth + 1)).join('\n'));
    }

    lines.push(`${indent}</node>`);
    return lines.join('\n');
  }

  return [
    '<map version="freeplane 1.6.0">',
    '<!--To view this file, download free mind mapping software Freeplane from https://www.freeplane.org -->',
    buildNode(tree, 0),
    '</map>'
  ].join('\n');
}

function countTreeNodes(node) {
  if (!node) {
    return 0;
  }

  let total = 1;
  for (const child of node.children || []) {
    total += countTreeNodes(child);
  }
  return total;
}

function createVymUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `{${crypto.randomUUID()}}`;
  }

  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const uuid = template.replace(/[xy]/g, char => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : ((rand & 0x3) | 0x8);
    return value.toString(16);
  });

  return `{${uuid}}`;
}

function buildVymXml(tree) {
  const vymVersion = '2.9.27';
  const topLevel = tree.children || [];
  const branchSpacingY = 110;
  const branchStartY = -Math.floor((Math.max(topLevel.length - 1, 0) * branchSpacingY) / 2);
  const branchOffsetX = 220;
  const branchTextColor = '#000000';
  const branchCount = Math.max(0, countTreeNodes(tree) - 1);
  const today = new Date().toISOString().slice(0, 10);

  function buildBranch(node, depth = 1, index = 0) {
    const indent = '    '.repeat(depth + 1);
    const attributes = [`uuid="${createVymUuid()}"`, 'hideLink="false"'];

    if (depth === 1) {
      attributes.push(`relPosX="${branchOffsetX}"`);
      attributes.push(`relPosY="${branchStartY + index * branchSpacingY}"`);
    }

    const children = node.children || [];
    const lines = [`${indent}<branch ${attributes.join(' ')}>`];
    lines.push(`${indent}    <heading textMode="plainText" textColor="${branchTextColor}" text="${escapeXml(node.name || 'unknown')}"></heading>`);

    for (const [childIndex, child] of children.entries()) {
      lines.push(buildBranch(child, depth + 1, childIndex));
    }

    lines.push(`${indent}</branch>`);
    return lines.join('\n');
  }

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE vymmap>',
    `<vymmap version="${vymVersion}" date="${today}" author="Mindmap Exporter" title="${escapeXml(tree.name || 'unknown')}" comment="" branchCount="${branchCount}" mapZoomFactor="1" mapRotation="0">`,
    `    <mapcenter uuid="${createVymUuid()}" posX="0" posY="0">`,
    `        <heading textMode="plainText" textColor="${branchTextColor}" text="${escapeXml(tree.name || 'unknown')}"></heading>`,
    topLevel.map((child, index) => buildBranch(child, 1, index)).join('\n'),
    '    </mapcenter>',
    '</vymmap>'
  ].join('\n');
}

function getDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);

  return { dosDate, dosTime };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosDate, dosTime } = getDosDateTime(now);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const checksum = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, entry.isDirectory ? 0x10 : 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

/**
 * Fetch the current raw NotebookLM payload for the active mindmap artifact.
 * This is the only function that should know about NotebookLM's private data.
 *
 * @param {number} tabId
 */
function fetchNotebookLmMindmapPayload(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      // Reverse-engineered NotebookLM contract. Keep the volatile pieces
      // together here so protocol/UI changes stay local to this function.
      //
      // High-level flow:
      // 1. Read artifact metadata from NotebookLM's Studio viewer buttons.
      // 2. Extract notebook/artifact IDs from the decoded jslog payload.
      // 3. Reuse request tokens exposed on window.WIZ_global_data.
      // 4. Call NotebookLM's private batchexecute RPC to fetch the tree.
      // 5. Unescape the embedded JSON payload and parse the first object.
      const NOTEBOOKLM_JSLOG_BASE64_MARKER = '0:';
      const NOTEBOOKLM_ARTIFACT_BUTTON_SELECTOR = 'artifact-viewer button[jslog]';
      const NOTEBOOKLM_UUID_RE = /^[0-9a-f-]{36}$/i;
      const NOTEBOOKLM_WIZ_GLOBAL_DATA_KEY = 'WIZ_global_data';
      const NOTEBOOKLM_WIZ_BUILD_LABEL_PRIMARY_KEY = 'KjTSIf';
      const NOTEBOOKLM_WIZ_BUILD_LABEL_FALLBACK_KEY = 'cfb2h';
      const NOTEBOOKLM_WIZ_SESSION_ID_KEY = 'FdrFJe';
      const NOTEBOOKLM_WIZ_AUTH_TOKEN_KEY = 'SNlM0e';
      const NOTEBOOKLM_BATCH_EXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute';
      const NOTEBOOKLM_MINDMAP_RPC_ID = 'v9rmvd';
      const NOTEBOOKLM_RESPONSE_DATA_MARKER = 'data-app-data';
      const NOTEBOOKLM_MINDMAP_RPC_OPTIONS = [
        2,
        null,
        null,
        [1, null, null, null, null, null, null, null, null, null, [1]],
        [[1, 4, 8, 10, 2, 3, 6, 7]]
      ];

      // NotebookLM keeps the artifact identifiers in a base64 payload inside
      // the Studio viewer buttons. We reuse that instead of guessing IDs.
      function decodeJslogValue(value) {
        const marker = NOTEBOOKLM_JSLOG_BASE64_MARKER;
        const start = value.indexOf(marker);
        if (start === -1) {
          return null;
        }

        const encoded = value.slice(start + marker.length).trim();
        try {
          return atob(encoded);
        } catch (error) {
          return null;
        }
      }

      // The RPC response contains the mindmap tree as an escaped JSON string
      // embedded in HTML. We isolate only the first full JSON object.
      function extractJsonObjectPrefix(text) {
        let depth = 0;
        let inString = false;
        let escaped = false;
        let started = false;
        let startIndex = -1;

        for (let i = 0; i < text.length; i += 1) {
          const ch = text[i];

          if (!started) {
            if (ch === '{') {
              started = true;
              startIndex = i;
              depth = 1;
            }
            continue;
          }

          if (escaped) {
            escaped = false;
            continue;
          }

          if (ch === '\\') {
            escaped = true;
            continue;
          }

          if (ch === '"') {
            inString = !inString;
            continue;
          }

          if (inString) {
            continue;
          }

          if (ch === '{') {
            depth += 1;
          } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              return text.slice(startIndex, i + 1);
            }
          }
        }

        return null;
      }

      // NotebookLM does not expose stable public artifact IDs in the visible
      // UI. The current Studio viewer embeds them in jslog attributes, so we
      // search those buttons instead of coupling export to iframe internals.
      const candidates = Array.from(
        document.querySelectorAll(NOTEBOOKLM_ARTIFACT_BUTTON_SELECTOR)
      );
      const shareButton = candidates.find(button => {
        const decoded = decodeJslogValue(button.getAttribute('jslog') || '');
        if (!decoded) {
          return false;
        }
        try {
          return JSON.parse(decoded)
            .flat(Infinity)
            .filter(v => typeof v === 'string' && NOTEBOOKLM_UUID_RE.test(v))
            .length >= 2;
        } catch (error) {
          return false;
        }
      });

      if (!shareButton) {
        return { error: 'Mindmap artifact not found in the current notebook view' };
      }

      const decoded = decodeJslogValue(shareButton.getAttribute('jslog') || '');
      if (!decoded) {
        return { error: 'Mindmap artifact metadata is missing' };
      }

      let notebookId;
      let artifactId;
      try {
        // Current reverse-engineered contract: the decoded jslog payload
        // contains the notebook ID and the artifact ID as UUID strings.
        const ids = JSON.parse(decoded)
          .flat(Infinity)
          .filter(value => typeof value === 'string' && NOTEBOOKLM_UUID_RE.test(value));
        [notebookId, artifactId] = ids;
      } catch (error) {
        return { error: 'Failed to decode mindmap artifact metadata' };
      }

      if (!notebookId || !artifactId) {
        return { error: 'Mindmap identifiers were not found' };
      }

      // The batchexecute request depends on NotebookLM tokens stored on the
      // page's global object, which is why this script runs in the MAIN world.
      const wiz = window[NOTEBOOKLM_WIZ_GLOBAL_DATA_KEY] || {};
      const bl = wiz[NOTEBOOKLM_WIZ_BUILD_LABEL_PRIMARY_KEY]
        || wiz[NOTEBOOKLM_WIZ_BUILD_LABEL_FALLBACK_KEY];
      const fSid = wiz[NOTEBOOKLM_WIZ_SESSION_ID_KEY];
      const at = wiz[NOTEBOOKLM_WIZ_AUTH_TOKEN_KEY];
      if (!bl || !fSid || !at) {
        return { error: 'NotebookLM request tokens are unavailable' };
      }

      // NOTEBOOKLM_MINDMAP_RPC_ID is a private RPC identifier discovered by
      // reverse-engineering NotebookLM network traffic. If Google changes this
      // RPC or its payload shape, export will fail even if the UI still loads.
      const params = new URLSearchParams({
        rpcids: NOTEBOOKLM_MINDMAP_RPC_ID,
        'source-path': `/notebook/${notebookId}`,
        bl,
        'f.sid': fSid,
        hl: document.documentElement.lang || 'en',
        _reqid: String(Date.now() % 1000000),
        rt: 'c'
      });

      const payload = [[[NOTEBOOKLM_MINDMAP_RPC_ID, JSON.stringify([
        artifactId,
        NOTEBOOKLM_MINDMAP_RPC_OPTIONS
      ]), null, 'generic']]];

      const body = new URLSearchParams({
        'f.req': JSON.stringify(payload),
        at
      });

      let text;
      try {
        const response = await fetch(`${NOTEBOOKLM_BATCH_EXECUTE_PATH}?${params.toString()}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-same-domain': '1'
          },
          body: body.toString()
        });

        if (!response.ok) {
          return { error: `Mindmap request failed (${response.status})` };
        }

        text = await response.text();
      } catch (error) {
        return { error: 'Failed to fetch current mindmap data' };
      }

      // The RPC response wraps the tree inside escaped HTML content rather
      // than returning a plain JSON document. We first locate the relevant
      // region, then reduce escaping, then parse the first full JSON object.
      const dataIndex = text.indexOf(NOTEBOOKLM_RESPONSE_DATA_MARKER);
      if (dataIndex === -1) {
        return { error: 'Mindmap payload not found in NotebookLM response' };
      }

      const rawJsonStart = text.indexOf('{', dataIndex);
      if (rawJsonStart === -1) {
        return { error: 'Mindmap JSON start not found' };
      }

      const rawPayload = text.slice(rawJsonStart);
      // The response is escaped twice: once as RPC text and once inside the
      // HTML attribute. Reduce it to plain JSON text before parsing.
      const singleEscaped = rawPayload.replace(/\\\\/g, '\\');
      const entityDecoded = singleEscaped
        .replace(/\\u0026quot;/g, '"')
        .replace(/\\u0026#39;/g, "'")
        .replace(/\\u0026gt;/g, '>')
        .replace(/\\u0026lt;/g, '<')
        .replace(/\\u0026amp;/g, '&')
        .replace(/\\n/g, '\n');

      const jsonText = extractJsonObjectPrefix(entityDecoded);
      if (!jsonText) {
        return { error: 'Mindmap JSON payload could not be isolated' };
      }

      try {
        return {
          payload: JSON.parse(jsonText)
        };
      } catch (error) {
        return { error: 'Mindmap JSON payload is invalid' };
      }
    }
  }).then(results => results[0]?.result || null);
}

/**
 * Load the current mindmap as the provider-agnostic domain model consumed by
 * the Markdown and SVG exporters.
 *
 * @param {number} tabId
 * @returns {Promise<MindmapLoadResult | null>}
 */
function loadCurrentMindmap(tabId) {
  return fetchNotebookLmMindmapPayload(tabId).then(result => {
    if (!result || result.error || !('payload' in result)) {
      return result;
    }

    try {
      return {
        mindmap: adaptMindmapPayload(result.payload)
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Mindmap tree shape is invalid'
      };
    }
  });
}

const exportMarkdown = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const { markdown, stats } = buildMarkdown(result.mindmap, getHeadingDepthLimit());
      const filename = getExportFilename('md', sanitizeRootName(result.mindmap.name));
      downloadBlob(new Blob([markdown], { type: 'text/markdown' }), filename);
      alert(`Export completed!\nTotal nodes: ${stats.total}`);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

const exportSVG = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const svg = buildMindmapSvg(result.mindmap, {
        interactive: getInteractiveSvgEnabled()
      });
      const filename = getExportFilename('svg', sanitizeRootName(result.mindmap.name));
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

const exportFreePlane = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const freePlane = buildFreePlane(result.mindmap);
      const filename = getExportFilename('mm', sanitizeRootName(result.mindmap.name));
      downloadBlob(new Blob([freePlane], { type: 'application/xml' }), filename);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

const exportVym = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    loadCurrentMindmap(tabs[0].id).then(result => {
      if (!result || result.error || !result.mindmap) {
        alert((result && result.error) || 'Mindmap frame not found');
        return;
      }

      const vymXml = buildVymXml(result.mindmap);
      const vymArchive = createStoredZip([
        { name: 'flags/', data: new Uint8Array(0), isDirectory: true },
        { name: 'flags/standard/', data: new Uint8Array(0), isDirectory: true },
        { name: 'flags/user/', data: new Uint8Array(0), isDirectory: true },
        { name: 'images/', data: new Uint8Array(0), isDirectory: true },
        { name: 'map.xml', data: vymXml, isDirectory: false }
      ]);

      const filename = getExportFilename('vym', sanitizeRootName(result.mindmap.name));
      downloadBlob(vymArchive, filename);
    }).catch(() => {
      alert('Mindmap export failed');
    });
  });
};

document.getElementById('exportMarkdown').addEventListener('click', exportMarkdown);
document.getElementById('exportFreePlane').addEventListener('click', exportFreePlane);
document.getElementById('exportVym').addEventListener('click', exportVym);
document.getElementById('exportSVG').addEventListener('click', exportSVG);
