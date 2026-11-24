/**
 * ProctorAI Browser Extension & Background Activity Detection Utility
 * Uses DOM signature probing, custom element inspection, window object scanning,
 * and input-injection checks to detect running browser extensions.
 */

export interface DetectedExtension {
  name: string;
  category: "AI_ASSISTANT" | "GRAMMAR_CHECKER" | "DEVTOOLS" | "TRANSLATOR" | "GENERIC_EXTENSION";
  signature: string;
}

export interface ExtensionScanResult {
  hasExtensions: boolean;
  detectedExtensions: DetectedExtension[];
  details: string[];
}

// Known extension signatures and global markers
const KNOWN_EXTENSION_MARKERS: Array<{
  name: string;
  category: DetectedExtension["category"];
  domSelectors: string[];
  windowProps: string[];
}> = [
  {
    name: "Monica AI Assistant",
    category: "AI_ASSISTANT",
    domSelectors: ["#monica-content-root", "div[id*='monica']", "monica-root", "div[class*='monica']"],
    windowProps: ["__monica__", "monica"]
  },
  {
    name: "Sider AI Sidebar",
    category: "AI_ASSISTANT",
    domSelectors: ["#sider-container", "div[class*='sider']", "sider-sidebar", "#ch-sider-root"],
    windowProps: ["__sider__", "sider"]
  },
  {
    name: "Merlin AI Copilot",
    category: "AI_ASSISTANT",
    domSelectors: ["div[class*='merlin']", "#merlin-chat-root", "merlin-app", "merlin-component"],
    windowProps: ["merlin", "__merlin__"]
  },
  {
    name: "Harpa AI Automation",
    category: "AI_ASSISTANT",
    domSelectors: ["#harpa-root", "div[id*='harpa']", "div[class*='harpa']"],
    windowProps: ["harpa", "__harpa__"]
  },
  {
    name: "ChatGPT / OpenAI Extension",
    category: "AI_ASSISTANT",
    domSelectors: ["div[id*='chatgpt-sidebar']", "div[class*='chatgpt-container']", "#openai-chat-sidebar", "div[id*='chatgpt']"],
    windowProps: ["__chatgpt_extension__"]
  },
  {
    name: "Grammarly / Writing Assistant",
    category: "GRAMMAR_CHECKER",
    domSelectors: [
      "grammarly-desktop-integration",
      "grammarly-extension",
      "div[data-grammarly-shadow-root]",
      "div[id*='grammarly']",
      "div.grammarly-inline-card"
    ],
    windowProps: ["Grammarly", "grammarly"]
  },
  {
    name: "QuillBot Writing Companion",
    category: "GRAMMAR_CHECKER",
    domSelectors: ["quillbot-extension-root", "div[class*='quillbot']", "#quillbot-root"],
    windowProps: ["quillbot", "__quillbot__"]
  },
  {
    name: "DeepL / Translation Extension",
    category: "TRANSLATOR",
    domSelectors: ["deepl-inline-translate", "div[class*='deepl']", "div[id*='deepl']"],
    windowProps: ["__deepl__"]
  },
  {
    name: "Developer Tools Extension",
    category: "DEVTOOLS",
    domSelectors: ["div[id*='react-devtools']", "div[id*='redux-devtools']"],
    windowProps: ["__REACT_DEVTOOLS_GLOBAL_HOOK__", "__REDUX_DEVTOOLS_EXTENSION__"]
  }
];

export function scanForActiveExtensions(): ExtensionScanResult {
  const detected: DetectedExtension[] = [];
  const details: string[] = [];

  // 1. Scan DOM for specific extension selectors
  for (const marker of KNOWN_EXTENSION_MARKERS) {
    let found = false;

    // Check DOM Selectors
    for (const selector of marker.domSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          detected.push({
            name: marker.name,
            category: marker.category,
            signature: `DOM Selector: ${selector}`
          });
          details.push(`${marker.name} detected via element [${selector}]`);
          found = true;
          break;
        }
      } catch {
        // Selector error
      }
    }

    if (found) continue;

    // Check Window Properties
    for (const prop of marker.windowProps) {
      if ((window as any)[prop] !== undefined) {
        detected.push({
          name: marker.name,
          category: marker.category,
          signature: `Window Property: window.${prop}`
        });
        details.push(`${marker.name} detected via runtime object window.${prop}`);
        break;
      }
    }
  }

  // 2. Scan for generic extension iframes or injected scripts
  try {
    const extensionIframes = document.querySelectorAll(
      "iframe[src*='chrome-extension://'], iframe[src*='moz-extension://'], script[src*='chrome-extension://'], link[href*='chrome-extension://']"
    );

    if (extensionIframes.length > 0) {
      detected.push({
        name: "Injected Browser Extension Resource",
        category: "GENERIC_EXTENSION",
        signature: `Extension Resource: ${extensionIframes.length} item(s) found in DOM`
      });
      details.push(`Detected ${extensionIframes.length} extension resource element(s) embedded in page.`);
    }
  } catch {
    // DOM probe error
  }

  // 3. Scan for generic elements with extension attributes
  try {
    const extElements = document.querySelectorAll(
      "[data-extension-id], [id*='extension'], [class*='extension-root'], [id*='ai-assistant'], [class*='ai-sidebar'], [id*='sidebar-root']"
    );

    // Filter out our own ProctorAI components if any match
    const foreignElements = Array.from(extElements).filter((el) => {
      const id = el.id.toLowerCase();
      const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
      return (
        !id.includes("proctor") &&
        !cls.includes("proctor") &&
        (id.includes("ai-") || id.includes("extension") || cls.includes("extension"))
      );
    });

    if (foreignElements.length > 0) {
      const el = foreignElements[0];
      const sig = el.id ? `#${el.id}` : `.${el.className}`;
      if (!detected.some((d) => d.signature.includes(sig))) {
        detected.push({
          name: "Unidentified Active Extension Element",
          category: "GENERIC_EXTENSION",
          signature: `Injected Node: ${sig}`
        });
        details.push(`Detected injected extension container: ${sig}`);
      }
    }
  } catch {
    // Query selector error
  }

  return {
    hasExtensions: detected.length > 0,
    detectedExtensions: detected,
    details
  };
}
