// ============================================================
// AdminOrganizations — every organization on the platform
// Route: /admin/organizations (RideWise admins only)
//
// Two things only RideWise itself may decide:
//   VERIFY    "this really is Riverside College" — shown as a green tick
//             wherever the organization appears, and listed first in search
//   SUSPEND   stops everything at once: running trips end, nobody outside
//             can see or track it, its drivers cannot start trips. Its own
//             admins can still open it and read why. Restoring undoes it.
//
// Platform admins do not see inside an organization from here (members,
// vehicles, positions) — only what is needed to judge it: who owns it,
// how big it is, whether it is in use.
// ============================================================

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { useLoad } from "../hooks/useFleet";
import AdminLayout from "./AdminLayout";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import { Badge, ConfirmButton, LiveDot } from "../components/org/kit";
import { formatDay, orgType } from "../components/org/fleetUi";
import { adminGetOrganizations, adminUpdateOrganization } from "../../services/orgApi";

const PAGE_SIZE = 20;

export default function AdminOrganizations() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const list = useLoad(`admin-orgs-${search}-${page}`, () => adminGetOrganizations(search, page, PAGE_SIZE));
  const data = list.data;

  const change = async (org, changes, done) => {
    setBusyId(org.id);
    try {
      await adminUpdateOrganization(org.id, changes);
      toast.success(done);
      list.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't change that organization.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organizations</h1>
            <p className={`mt-1 text-sm ${tc.sub}`}>
              {data ? `${data.total} organization${data.total === 1 ? "" : "s"}${search ? ` matching “${search}”` : ""}` : "Loading…"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or code…"
              aria-label="Search organizations by name or code"
              className={`w-full rounded-lg border py-2.5 pl-9 pr-4 text-sm ${tc.input}`}
            />
          </div>
        </div>

        {list.error && !data && (
          <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${tc.dangerSoft}`}>
            <Icon name="alertTriangle" size={16} />
            <span className="flex-1">{list.error.message}</span>
            <Button variant="secondary" size="sm" icon="refresh" tc={tc} onClick={list.reload}>Try again</Button>
          </div>
        )}

        <div className={`overflow-hidden rounded-xl border ${tc.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${tc.divider}`}>
                  <th className="px-4 py-3 text-left font-semibold">Organization</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Owner</th>
                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Size</th>
                  <th className="px-4 py-3 text-left font-semibold">State</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.loading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <span className="inline-flex items-center gap-2">
                        <Icon name="spinner" size={16} className="rw-spin" />
                        <span className={tc.sub}>Loading organizations…</span>
                      </span>
                    </td>
                  </tr>
                )}

                {!list.loading && data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`py-12 text-center ${tc.sub}`}>
                      <span className="flex flex-col items-center gap-3">
                        <Icon name="building" size={28} />
                        {search ? "No organization matches your search." : "No organizations have been created yet."}
                      </span>
                    </td>
                  </tr>
                )}

                {!list.loading && data?.items.map((org) => {
                  const suspended = org.status === "SUSPENDED";
                  const busy = busyId === org.id;
                  return (
                    <tr key={org.id} className={`border-b last:border-b-0 ${tc.divider}`}>
                      <td className="px-4 py-3 align-top">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                          {org.name}
                          {org.verified && <Icon name="checkCircle" size={14} className={tc.ok} title="Verified" />}
                        </p>
                        <p className={`mt-0.5 text-xs ${tc.sub}`}>
                          <span className="font-mono">{org.orgCode}</span> · {orgType(org.orgType).label} ·{" "}
                          {org.visibility === "PRIVATE" ? "Private" : "Public"} · since {formatDay(org.createdAt)}
                        </p>
                        <p className={`mt-0.5 text-xs md:hidden ${tc.sub}`}>@{org.ownerUsername || "—"}</p>
                      </td>
                      <td className="hidden px-4 py-3 align-top md:table-cell">
                        <p>@{org.ownerUsername || "—"}</p>
                        <p className={`text-xs ${tc.sub}`}>{org.ownerEmail}</p>
                      </td>
                      <td className={`hidden px-4 py-3 align-top text-xs sm:table-cell ${tc.sub}`}>
                        <p>{org.vehicleCount} vehicles · {org.memberCount} members</p>
                        {org.activeTrips > 0 && (
                          <p className={`mt-0.5 inline-flex items-center gap-1.5 font-semibold ${tc.ok}`}>
                            <LiveDot />{org.activeTrips} on a trip
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge tone={suspended ? "danger" : "ok"} tc={tc}>{suspended ? "Suspended" : "Active"}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variant={org.verified ? "ghost" : "secondary"}
                            size="sm"
                            icon={org.verified ? "close" : "checkCircle"}
                            tc={tc}
                            disabled={busy}
                            onClick={() => change(org, { verified: !org.verified },
                              org.verified ? `${org.name} is no longer marked as verified.` : `${org.name} is verified.`)}
                          >
                            {org.verified ? "Unverify" : "Verify"}
                          </Button>
                          {suspended ? (
                            <Button variant="secondary" size="sm" icon="check" tc={tc} loading={busy}
                              onClick={() => change(org, { status: "ACTIVE" }, `${org.name} is active again.`)}>
                              Restore
                            </Button>
                          ) : (
                            <ConfirmButton
                              label="Suspend"
                              confirmLabel={org.activeTrips > 0 ? `Suspend · ends ${org.activeTrips} trip${org.activeTrips === 1 ? "" : "s"}` : "Suspend"}
                              icon="ban"
                              tc={tc}
                              disabled={busy}
                              onConfirm={() => change(org, { status: "SUSPENDED" }, `${org.name} is suspended.`)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" icon="chevronLeft" tc={tc} disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className={`text-xs tabular-nums ${tc.sub}`}>Page {page + 1} of {data.totalPages}</span>
            <Button variant="ghost" size="sm" icon="chevronRight" iconRight tc={tc}
              disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
