import { Check } from "lucide-react";
import { PlatformIcon, platformMeta } from "../components/shared";
import type { Connection, Platform, PlatformCapabilities } from "../types";
import { summarizeCapability } from "./PlatformCustomizePanel";

/** شبكة اختيار المنصات - مشتركة بين الوضع البسيط والمتقدم حتى يتطابق السلوك والمظهر تمامًا. */
export function PlatformSelector({ connections, capabilities, selected, onToggle }: {
  connections: Connection[];
  capabilities: PlatformCapabilities[];
  selected: Platform[];
  onToggle: (platform: Platform) => void;
}) {
  const capabilityByPlatform = new Map(capabilities.map((item) => [item.platform, item]));
  return (
    <div className="platform-selector grid">
      {connections.map((connection) => {
        const active = selected.includes(connection.platform);
        const capability = capabilityByPlatform.get(connection.platform);
        return (
          <button
            key={connection.platform}
            type="button"
            className={`platform-choice ${active ? "selected" : ""} ${connection.connected ? "" : "unconnected"}`}
            aria-pressed={active}
            onClick={() => onToggle(connection.platform)}
          >
            <PlatformIcon platform={connection.platform} />
            <span>
              <strong>{platformMeta[connection.platform].name}</strong>
              <small>{connection.connected ? connection.accountName : "غير متصل - يمكن الاختيار للجدولة، لكن لن يُتاح النشر الفوري"}</small>
              {capability && <small className="platform-choice-caps">{summarizeCapability(capability)}</small>}
            </span>
            <span className="choice-check">{active && <Check size={14} />}</span>
          </button>
        );
      })}
    </div>
  );
}
