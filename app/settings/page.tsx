"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { PosSettings, SystemInfo } from "@/types/electron";
import "./settings.css";

const defaults: PosSettings = {
  shopName: "Toy and Stationery Shop",
  shopPhone: "",
  shopAddress: "",
  receiptFooter: "Thank you for shopping with us.",
  receiptShowShopName: true,
  receiptShowPhone: true,
  receiptShowAddress: true,
  receiptShowFooter: true,
  defaultLowStockLevel: 5,
  allowUnpaidOrderCompletion: true,
};

const getElectronApi = () =>
  typeof window !== "undefined" ? window.electron : undefined;

export default function SettingsPage() {
  const [settings, setSettings] = useState<PosSettings>(defaults);
  const [savedSettings, setSavedSettings] = useState<PosSettings>(defaults);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const api = getElectronApi();

      if (!api?.settings) {
        throw new Error(
          "Settings API is unavailable. Please restart the POS application."
        );
      }

      const [values, info] = await Promise.all([
        api.settings.getAll(),
        api.settings.getSystemInfo(),
      ]);

      setSettings(values);
      setSavedSettings(values);
      setSystemInfo(info);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load settings."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changed =
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const update = <K extends keyof PosSettings>(
    key: K,
    value: PosSettings[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const save = async () => {
    if (!settings.shopName.trim()) {
      return setError("Shop name cannot be empty.");
    }

    if (
      !Number.isInteger(settings.defaultLowStockLevel) ||
      settings.defaultLowStockLevel < 0
    ) {
      return setError(
        "Default low stock alert must be a non-negative whole number."
      );
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const api = getElectronApi();

      if (!api?.settings) {
        throw new Error(
          "Settings API is unavailable. Please restart the POS application."
        );
      }

      const saved = await api.settings.update(settings);

      setSettings(saved);
      setSavedSettings(saved);

      setNotice("Settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save settings. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="settings-page">
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>Configure your shop and POS preferences.</p>
          </div>
        </header>

        {loading && (
          <div className="settings-loading">
            Loading settings...
          </div>
        )}

        {notice && (
          <div className="settings-notice">
            {notice}
          </div>
        )}

        {error && (
          <div className="settings-error">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <h2>Shop Information</h2>
                  <p>
                    Information used by your POS and future receipts.
                  </p>
                </div>
              </div>

              <div className="settings-fields">
                <Field
                  label="Shop Name"
                  value={settings.shopName}
                  onChange={(value) =>
                    update("shopName", value)
                  }
                />

                <Field
                  label="Phone Number"
                  value={settings.shopPhone}
                  onChange={(value) =>
                    update("shopPhone", value)
                  }
                />

                <Field
                  label="Address"
                  value={settings.shopAddress}
                  onChange={(value) =>
                    update("shopAddress", value)
                  }
                />

                <Field
                  label="Receipt Footer / Message"
                  value={settings.receiptFooter}
                  onChange={(value) =>
                    update("receiptFooter", value)
                  }
                  textarea
                />
              </div>

              <div className="settings-actions">
                <button
                  className="settings-primary"
                  disabled={!changed || saving}
                  onClick={save}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <h2>Receipt Settings</h2>
                  <p>
                    Choose which shop details appear when receipts
                    are added.
                  </p>
                </div>
              </div>

              <Toggle
                label="Show Shop Name"
                checked={settings.receiptShowShopName}
                onChange={(value) =>
                  update("receiptShowShopName", value)
                }
              />

              <Toggle
                label="Show Phone Number"
                checked={settings.receiptShowPhone}
                onChange={(value) =>
                  update("receiptShowPhone", value)
                }
              />

              <Toggle
                label="Show Address"
                checked={settings.receiptShowAddress}
                onChange={(value) =>
                  update("receiptShowAddress", value)
                }
              />

              <Toggle
                label="Show Receipt Footer"
                checked={settings.receiptShowFooter}
                onChange={(value) =>
                  update("receiptShowFooter", value)
                }
              />
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <h2>Sales Settings</h2>
                  <p>
                    Set defaults for inventory and order completion.
                  </p>
                </div>
              </div>

              <label className="settings-number-field">
                Default Low Stock Alert

                <input
                  type="number"
                  min="0"
                  value={settings.defaultLowStockLevel}
                  onChange={(event) =>
                    update(
                      "defaultLowStockLevel",
                      Number(event.target.value)
                    )
                  }
                />
              </label>

              <Toggle
                label="Allow unpaid orders to be completed"
                checked={
                  settings.allowUnpaidOrderCompletion
                }
                onChange={(value) =>
                  update(
                    "allowUnpaidOrderCompletion",
                    value
                  )
                }
              />
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <h2>System Information</h2>
                  <p>
                    Read-only paths and application details.
                  </p>
                </div>
              </div>

              <SystemRow
                label="App Version"
                value={
                  systemInfo?.appVersion ?? "-"
                }
              />

              <SystemRow
                label="Database"
                value={
                  systemInfo?.databaseName ?? "-"
                }
              />

              <SystemRow
                label="Database Location"
                value={
                  systemInfo?.databasePath ?? "-"
                }
              />

              <SystemRow
                label="Backup Folder"
                value={
                  systemInfo?.backupPath ?? "-"
                }
              />

              <div className="settings-actions">
                <button
                  className="settings-secondary"
                  onClick={() =>
                    getElectronApi()?.backup?.openFolder()
                  }
                >
                  Open Backup Folder
                </button>
              </div>

              <div className="settings-branding">
                <span>Made by</span>
                <strong>
                  Rangoon Digital Solution
                </strong>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="settings-field">
      {label}

      {textarea ? (
        <textarea
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      ) : (
        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      )}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <i aria-hidden="true" />
    </label>
  );
}

function SystemRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="system-row">
      <span>{label}</span>

      <strong title={value}>
        {value}
      </strong>
    </div>
  );
}