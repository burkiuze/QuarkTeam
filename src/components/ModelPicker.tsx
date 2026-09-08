import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, SlidersHorizontal, Zap } from "lucide-react";
import type { ProviderPreset, QuarkSettings } from "../types";

const MENU_WIDTH = 330;

type Props = {
  settings: QuarkSettings;
  providers: ProviderPreset[];
  onSelect: (providerId: string, modelId: string) => void;
  onManage: () => void;
  disabled?: boolean;
};

/**
 * Model chooser shared by the hero composer and the side panel. Models come
 * from each provider's cached catalogue, so switching provider is one click
 * rather than a trip through settings.
 */
export function ModelPicker({ settings, providers, onSelect, onManage, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    // The docked composer clips its children, so the menu is positioned against
    // the viewport instead of the chip's scrolling ancestor.
    const place = () => {
      const rect = chipRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)),
        bottom: Math.max(12, window.innerHeight - rect.top + 8),
      });
    };
    place();
    window.addEventListener("resize", place);

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const providerName = (providerId: string) =>
    providers.find((item) => item.providerId === providerId)?.name ?? providerId;

  const isLocal = (providerId: string) =>
    providers.find((item) => item.providerId === providerId)?.local ?? false;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return settings.accounts
      .map((account) => ({
        providerId: account.providerId,
        name: providerName(account.providerId) + (isLocal(account.providerId) ? " (local)" : ""),
        models: account.models.filter(
          (model) =>
            (!freeOnly || model.free) &&
            (!needle ||
              model.label.toLowerCase().includes(needle) ||
              model.id.toLowerCase().includes(needle)),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [settings.accounts, query, freeOnly, providers]);

  const freeCount = settings.accounts.reduce(
    (total, account) => total + account.models.filter((model) => model.free).length,
    0,
  );

  const activeAccount = settings.accounts.find(
    (account) => account.providerId === settings.activeProviderId,
  );
  const activeModel = activeAccount?.models.find((model) => model.id === settings.activeModel);
  const activeLabel = activeModel?.label ?? settings.activeModel ?? "Select a model";

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        ref={chipRef}
        className={`model-chip ${open ? "open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
      >
        <Zap size={13} />
        <span>{activeLabel}</span>
        <ChevronDown size={13} />
      </button>

      {open ? (
        <div
          className="model-menu"
          role="listbox"
          style={
            anchor
              ? { left: anchor.left, bottom: anchor.bottom, width: MENU_WIDTH }
              : { visibility: "hidden" }
          }
        >
          <div className="model-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
            />
            {freeCount ? (
              <button
                type="button"
                className={`model-free-toggle ${freeOnly ? "on" : ""}`}
                onClick={() => setFreeOnly((value) => !value)}
                title="Show only free models"
              >
                Free {freeCount}
              </button>
            ) : null}
          </div>

          <div className="model-list">
            {groups.length ? (
              groups.map((group) => (
                <div className="model-group" key={group.providerId}>
                  <div className="model-group-name">{group.name}</div>
                  {group.models.map((model) => {
                    const selected =
                      group.providerId === settings.activeProviderId &&
                      model.id === settings.activeModel;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`model-row ${selected ? "selected" : ""}`}
                        key={`${group.providerId}:${model.id}`}
                        title={model.id}
                        onClick={() => {
                          onSelect(group.providerId, model.id);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="model-name">{model.label}</span>
                        {model.free ? <span className="model-badge">Free</span> : null}
                        {selected ? <Check size={14} className="model-check" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="model-empty">
                {query || freeOnly
                  ? "No model matches that filter."
                  : "No models cached yet. Open Manage models and fetch a provider."}
              </div>
            )}
          </div>

          <button
            type="button"
            className="model-manage"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            <SlidersHorizontal size={14} />
            Manage models
          </button>
        </div>
      ) : null}
    </div>
  );
}
