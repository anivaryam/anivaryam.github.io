import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  SMART_COLLECTION_ANY_NOTICE,
  SMART_COLLECTION_STATUSES,
  SMART_INVENTORY_OPERATORS,
  type SmartCollectionOptionsInput,
} from "@/lib/related-product/smart-collection";

export function SmartCollectionSettings({
  settings, onChange, disabled,
}: {
  settings: SmartCollectionOptionsInput;
  onChange: (settings: SmartCollectionOptionsInput) => void;
  disabled: boolean;
}) {
  const inventory = settings.inventory ?? DEFAULT_SMART_COLLECTION_OPTIONS.inventory;
  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Smart collection settings</legend>
      <div className="flex items-center gap-2">
        <Checkbox
          id="related-use-category"
          checked={settings.useCategory}
          onCheckedChange={(checked) => onChange({ ...settings, useCategory: checked === true })}
          disabled={disabled}
        />
        <Label htmlFor="related-use-category">Add category condition</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="related-available-categories">Available categories (optional)</Label>
        <Textarea
          id="related-available-categories"
          value={Array.isArray(settings.availableCategories) ? settings.availableCategories.join("\n") : settings.availableCategories}
          onChange={(event) => onChange({ ...settings, availableCategories: event.target.value })}
          placeholder={"Paste this client’s category labels\nOne category per line"}
          className="min-h-24 text-sm"
          disabled={disabled || !settings.useCategory}
          aria-describedby="related-category-help"
          data-lenisignore
        />
        <p id="related-category-help" className="text-xs leading-relaxed text-muted-foreground">
          Category is off by default because product assignments are unverified. If enabled, supplied labels constrain suggestions (up to 200, each at most 120 characters); a blank list allows unverified labels. Confirm product assignments in Shopify. New check clears this list and restores defaults.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="related-match-conditions">Match conditions</Label>
        <select
          id="related-match-conditions"
          value={settings.match}
          onChange={(event) => onChange({ ...settings, match: event.target.value as SmartCollectionOptionsInput["match"] })}
          className={selectClass}
          disabled={disabled}
        >
          <option value="all">ALL conditions</option>
          <option value="any">ANY condition</option>
        </select>
      </div>
      {settings.match === "any" && <Alert><AlertDescription className="text-xs leading-relaxed">{SMART_COLLECTION_ANY_NOTICE}</AlertDescription></Alert>}
      <div className="flex items-center gap-2">
        <Checkbox
          id="related-include-subcategories"
          checked={settings.includeSubcategories}
          onCheckedChange={(checked) => onChange({ ...settings, includeSubcategories: checked === true })}
          disabled={disabled || !settings.useCategory}
        />
        <Label htmlFor="related-include-subcategories">Include subcategories</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="related-product-status">Product status</Label>
        <select
          id="related-product-status"
          value={settings.status ?? "any"}
          onChange={(event) => onChange({
            ...settings,
            status: event.target.value === "any" ? null : event.target.value as SmartCollectionOptionsInput["status"],
          })}
          className={selectClass}
          disabled={disabled}
        >
          <option value="any">No status condition</option>
          {SMART_COLLECTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="related-use-inventory"
          checked={settings.inventory !== null}
          onCheckedChange={(checked) => onChange({
            ...settings,
            inventory: checked === true ? { ...DEFAULT_SMART_COLLECTION_OPTIONS.inventory } : null,
          })}
          disabled={disabled}
        />
        <Label htmlFor="related-use-inventory">Add inventory condition</Label>
      </div>
      {settings.inventory !== null && (
        <div className="grid min-w-0 gap-3">
          <div className="space-y-2">
            <Label htmlFor="related-inventory-operator">Inventory comparison</Label>
            <select
              id="related-inventory-operator"
              value={inventory.operator}
              onChange={(event) => onChange({
                ...settings,
                inventory: { ...inventory, operator: event.target.value as typeof inventory.operator },
              })}
              className={selectClass}
              disabled={disabled}
            >
              {SMART_INVENTORY_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="related-inventory-value">Inventory value</Label>
            <Input
              id="related-inventory-value"
              type="number"
              step="1"
              value={inventory.value}
              onChange={(event) => onChange({ ...settings, inventory: { ...inventory, value: event.target.value } })}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
