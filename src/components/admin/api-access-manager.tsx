"use client";

import { useState } from "react";
import type { ApiClientSummary } from "@/lib/api/clients";
import type { ApiScope } from "@/lib/api/scopes";

interface ScopeOption {
  scope: ApiScope;
  description: string;
}

function statusLabel(client: ApiClientSummary): { label: string; className: string } {
  if (!client.isActive || client.revokedAt) {
    return { label: "Revoked", className: "bg-govuk-light-grey text-govuk-dark-grey" };
  }
  if (client.expiresAt && new Date(client.expiresAt).getTime() <= Date.now()) {
    return { label: "Expired", className: "bg-[#fff7e6] text-[#8a4b00]" };
  }
  return { label: "Active", className: "bg-[#e6f4ea] text-[#00703c]" };
}

export function ApiAccessManager({
  initialClients,
  scopes,
}: {
  initialClients: ApiClientSummary[];
  scopes: ScopeOption[];
}) {
  const [clients, setClients] = useState<ApiClientSummary[]>(initialClients);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiScope>>(new Set());
  const [expiresInDays, setExpiresInDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: ApiScope) {
    setSelectedScopes((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNewKey(null);
    setCopied(false);
    setCreating(true);
    try {
      const response = await fetch("/api/admin/api-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          scopes: [...selectedScopes],
          expiresInDays: expiresInDays.trim() === "" ? null : Number(expiresInDays),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "The API client could not be created.");
      }
      setClients((current) => [payload.client, ...current]);
      setNewKey({ name: payload.client.name, apiKey: payload.apiKey });
      setName("");
      setDescription("");
      setSelectedScopes(new Set());
      setExpiresInDays("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(client: ApiClientSummary) {
    if (!window.confirm(`Revoke "${client.name}"? Systems using this key will stop working immediately.`)) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/admin/api-clients/${client.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "The API client could not be revoked.");
      }
      setClients((current) =>
        current.map((item) => (item.id === client.id ? payload.client : item)),
      );
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Something went wrong.");
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.apiKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section aria-labelledby="create-key-heading">
        <h2 id="create-key-heading" className="text-xl font-bold mb-4">
          Create an API key
        </h2>

        {newKey && (
          <div className="mb-6 border-l-4 border-[#00703c] bg-[#e6f4ea] p-4" role="alert">
            <p className="font-bold">Copy the key for “{newKey.name}” now</p>
            <p className="mb-2 text-sm">
              This is the only time the full key is shown. Store it in your secret manager.
            </p>
            <code className="block break-all bg-white border border-govuk-mid-grey p-2 text-sm">
              {newKey.apiKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="govuk-button govuk-button--secondary mt-3 no-underline"
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 border-l-4 border-[#d4351c] bg-[#fef0ef] p-3 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="bg-white border border-govuk-mid-grey p-5">
          <div className="mb-4">
            <label htmlFor="client-name" className="block font-bold mb-1">
              Name
            </label>
            <input
              id="client-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
              className="w-full border-2 border-[#0b0c0c] p-2"
              placeholder="e.g. Council data warehouse"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="client-description" className="block font-bold mb-1">
              Description <span className="font-normal text-govuk-dark-grey">(optional)</span>
            </label>
            <input
              id="client-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              className="w-full border-2 border-[#0b0c0c] p-2"
              placeholder="What will use this key?"
            />
          </div>

          <fieldset className="mb-4">
            <legend className="font-bold mb-2">Scopes</legend>
            <div className="space-y-2">
              {scopes.map((option) => (
                <label key={option.scope} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={selectedScopes.has(option.scope)}
                    onChange={() => toggleScope(option.scope)}
                  />
                  <span>
                    <code className="font-bold">{option.scope}</code>
                    <span className="block text-sm text-govuk-dark-grey">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mb-5">
            <label htmlFor="client-expiry" className="block font-bold mb-1">
              Expires after (days){" "}
              <span className="font-normal text-govuk-dark-grey">(optional)</span>
            </label>
            <input
              id="client-expiry"
              type="number"
              min={1}
              max={3650}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              className="w-40 border-2 border-[#0b0c0c] p-2"
              placeholder="Never"
            />
          </div>

          <button
            type="submit"
            disabled={creating || selectedScopes.size === 0 || name.trim().length < 2}
            className="govuk-button no-underline disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create API key"}
          </button>
        </form>
      </section>

      <section aria-labelledby="existing-keys-heading">
        <h2 id="existing-keys-heading" className="text-xl font-bold mb-4">
          API keys ({clients.length})
        </h2>
        {clients.length === 0 ? (
          <p className="text-govuk-dark-grey">No API keys have been created yet.</p>
        ) : (
          <ul className="space-y-4">
            {clients.map((client) => {
              const status = statusLabel(client);
              return (
                <li key={client.id} className="bg-white border border-govuk-mid-grey p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{client.name}</p>
                      {client.description && (
                        <p className="text-sm text-govuk-dark-grey">{client.description}</p>
                      )}
                      <code className="mt-1 block text-sm text-govuk-dark-grey">
                        {client.keyPrefix}…
                      </code>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-1 text-sm font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {client.scopes.map((scope) => (
                      <code
                        key={scope}
                        className="bg-govuk-light-grey px-2 py-0.5 text-xs"
                      >
                        {scope}
                      </code>
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-govuk-dark-grey">
                    <div>
                      <dt className="font-bold">Created</dt>
                      <dd>{new Date(client.createdAt).toLocaleDateString("en-GB")}</dd>
                    </div>
                    <div>
                      <dt className="font-bold">Last used</dt>
                      <dd>
                        {client.lastUsedAt
                          ? new Date(client.lastUsedAt).toLocaleString("en-GB")
                          : "Never"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold">Expires</dt>
                      <dd>
                        {client.expiresAt
                          ? new Date(client.expiresAt).toLocaleDateString("en-GB")
                          : "Never"}
                      </dd>
                    </div>
                  </dl>
                  {client.isActive && !client.revokedAt && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(client)}
                      className="mt-3 text-sm font-bold text-[#d4351c] underline"
                    >
                      Revoke key
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
