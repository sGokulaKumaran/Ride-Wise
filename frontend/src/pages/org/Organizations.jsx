// ============================================================
// Organizations — everything about organizations, in one place
// Route: /organizations (protected)
//
// TWO TABS
//   Mine   invitations waiting for an answer · organizations I run ·
//          organizations I drive for · organizations on my list
//   Find   search public organizations by name, or open a private one
//          with its code and password
//
// One person can be several things at once — the owner of one
// organization, a driver in another, a passenger of a third — so this
// page shows all of them side by side instead of making the user pick
// "what kind of account" they are.
//
// DEEP LINKS
//   /organizations?tab=find         opens the Find tab
//   /organizations?q=<text>         …with that search
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useOrgs } from "../../context/OrgContext";
import { useDriverTrip } from "../../context/DriverTripContext";
import { useTheme } from "../hooks/useTheme";
import { useLoad } from "../hooks/useFleet";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import {
  AppShell, ErrorNote, Field, LiveDot, Loading, Notice, OrgAvatar, PageHeader, Section, TabStrip, TextInput,
} from "../components/org/kit";
import { OrgRow } from "../components/org/rows";
import { ROLE_LABEL, orgType, tripTitle } from "../components/org/fleetUi";
import {
  acceptInvitation,
  getSavedOrganizations,
  openPrivateOrganization,
  rejectInvitation,
  searchOrganizations,
} from "../../services/orgApi";

const roleWords = { ADMIN: "an admin", DRIVER: "a driver", VIEWER: "a viewer" };

export default function Organizations() {
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { summary, loaded, refresh } = useOrgs();
  const { trip } = useDriverTrip();

  const tab = searchParams.get("tab") === "find" || searchParams.get("q") ? "find" : "mine";
  const setTab = (next) => setSearchParams(next === "find" ? { tab: "find" } : {}, { replace: true });

  // Always fresh when the page is opened (an invitation may just have arrived).
  useEffect(() => { refresh(); }, [refresh]);

  const saved = useLoad(userId != null ? `saved-${userId}` : null, getSavedOrganizations);

  // ── Invitations ──
  const [answering, setAnswering] = useState(null);
  const answer = async (invitation, accept) => {
    setAnswering(invitation.memberId);
    try {
      if (accept) {
        await acceptInvitation(invitation.memberId);
        toast.success(`You joined ${invitation.orgName} as ${roleWords[invitation.role] || "a member"}.`);
      } else {
        await rejectInvitation(invitation.memberId);
        toast.info(`Invitation from ${invitation.orgName} declined.`);
      }
    } catch (err) {
      toast.error(err.message || "That didn't work. Please try again.");
    } finally {
      setAnswering(null);
      refresh();
    }
  };

  const memberOrgIds = new Set([...summary.managed, ...summary.driving].map((org) => org.id));
  const savedOnly = (saved.data || []).filter((org) => !memberOrgIds.has(org.id));
  const nothingYet =
    loaded && !saved.loading &&
    summary.managed.length === 0 && summary.driving.length === 0 &&
    summary.invitations.length === 0 && savedOnly.length === 0;

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
      <PageHeader
        tc={tc}
        title="Organizations"
        subtitle="Follow the vehicles of your college, hospital or company live — or run your own fleet."
        actions={
          <Button variant="primary" icon="plus" tc={tc} onClick={() => navigate("/create-organization")}>
            New organization
          </Button>
        }
      />

      <TabStrip
        tc={tc}
        label="Organizations"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "mine", label: "Mine", icon: "building", count: summary.invitations.length },
          { id: "find", label: "Find", icon: "search" },
        ]}
      />

      {tab === "mine" && (
        <div className="space-y-8">
          {/* ── A trip I am driving right now ── */}
          {trip && (
            <button
              type="button"
              onClick={() => navigate("/driver/session")}
              className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${tc.okSoft}`}
            >
              <LiveDot />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  You are driving {trip.session.vehicleCode}
                </span>
                <span className="block truncate text-xs opacity-90">
                  {trip.orgName} · {tripTitle(trip.session)}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                Open <Icon name="arrowRight" size={13} />
              </span>
            </button>
          )}

          {/* ── Invitations ── */}
          {summary.invitations.length > 0 && (
            <Section title="Invitations" count={summary.invitations.length} tc={tc}>
              <div className="space-y-2">
                {summary.invitations.map((invitation) => (
                  <div key={invitation.memberId} className={`rounded-xl border p-3.5 ${tc.accentSoft}`}>
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={invitation.orgName} tc={tc} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${tc.text}`}>
                          {invitation.orgName}
                          {invitation.verified && <Icon name="checkCircle" size={14} className={`ml-1.5 inline ${tc.ok}`} />}
                        </p>
                        <p className={`text-xs ${tc.sub}`}>
                          {invitation.invitedByName} invited you as {roleWords[invitation.role] || "a member"} ·{" "}
                          {orgType(invitation.orgType).label}
                        </p>
                      </div>
                    </div>
                    <p className={`mt-2 text-xs ${tc.sub}`}>
                      {invitation.role === "VIEWER"
                        ? "You will see where its vehicles are. Its admins will see your name, email and phone number."
                        : "You will be able to take its vehicles out on trips. Its admins will see your name, email and phone number."}
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" tc={tc} disabled={answering === invitation.memberId}
                        onClick={() => answer(invitation, false)}>
                        Decline
                      </Button>
                      <Button variant="primary" size="sm" icon="check" tc={tc}
                        loading={answering === invitation.memberId} onClick={() => answer(invitation, true)}>
                        Join as {ROLE_LABEL[invitation.role] || "member"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!loaded ? (
            <Loading label="Loading your organizations…" tc={tc} />
          ) : (
            <>
              {summary.managed.length > 0 && (
                <Section title="You manage" tc={tc}>
                  <div className="space-y-2">
                    {summary.managed.map((org) => (
                      <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/organizations/${org.id}`)}>
                        <Button variant="secondary" size="sm" icon="settings" tc={tc}
                          onClick={() => navigate(`/org-admin/${org.id}/dashboard`)}>
                          Manage
                        </Button>
                      </OrgRow>
                    ))}
                  </div>
                </Section>
              )}

              {summary.driving.length > 0 && (
                <Section title="You drive for" tc={tc}>
                  <div className="space-y-2">
                    {summary.driving.map((org) => (
                      <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/organizations/${org.id}`)}>
                        <Button variant="secondary" size="sm" icon="steering" tc={tc}
                          onClick={() => navigate(`/driver?org=${org.id}`)}>
                          Drive
                        </Button>
                      </OrgRow>
                    ))}
                  </div>
                </Section>
              )}

              {savedOnly.length > 0 && (
                <Section title="On your list" tc={tc}>
                  <div className="space-y-2">
                    {savedOnly.map((org) => (
                      <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/organizations/${org.id}`)} />
                    ))}
                  </div>
                </Section>
              )}

              {nothingYet && (
                <Notice
                  icon="building"
                  title="No organizations yet"
                  tc={tc}
                  action={
                    <>
                      <Button variant="primary" icon="search" tc={tc} onClick={() => setTab("find")}>
                        Find an organization
                      </Button>
                      <Button variant="secondary" icon="plus" tc={tc} onClick={() => navigate("/create-organization")}>
                        Create one
                      </Button>
                    </>
                  }
                >
                  Find your college, hospital or company to see where its vehicles are right now. To drive for one,
                  ask its admin to invite you — your username is @{user?.username}.
                </Notice>
              )}
            </>
          )}
        </div>
      )}

      {tab === "find" && (
        <FindTab
          tc={tc}
          initialQuery={(searchParams.get("q") || "").trim()}
          onOpen={(org) => navigate(`/organizations/${org.id}`)}
          onOpened={() => { refresh(); saved.reload(); }}
        />
      )}
    </AppShell>
  );
}

// ============================================================
// Find — public search, and the code + password door for private ones
// ============================================================
function FindTab({ tc, initialQuery, onOpen, onOpened }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState({ query: "", list: [], failed: false });
  const [searching, setSearching] = useState(false);

  // Debounced; an answer for an older text never replaces a newer one.
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchOrganizations(term, { signal: controller.signal })
        .then((list) => setResults({ query: term, list: list || [], failed: false }))
        .catch((err) => {
          if (err?.name !== "AbortError") setResults({ query: term, list: [], failed: true });
        })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const settled = results.query === term;

  // ── Private organization: code + password ──
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const openPrivate = async (event) => {
    event.preventDefault();
    setError("");
    if (!code.trim()) { setError("Enter the organization's code."); return; }
    setOpening(true);
    try {
      const org = await openPrivateOrganization(code, password);
      toast.success(`${org.name} is now on your list.`);
      onOpened();
      onOpen(org);
    } catch (err) {
      setError(err.message || "That didn't work. Please try again.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-label="Search public organizations">
        <div className="relative mb-4">
          <Icon name="search" size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
          <input
            type="search"
            aria-label="Search organizations by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="College, hospital or company name"
            autoFocus
            className={`w-full rounded-lg border py-3 pl-10 pr-10 text-sm ${tc.input}`}
          />
          {searching && (
            <Icon name="spinner" size={16} className={`rw-spin absolute right-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
          )}
        </div>

        {term.length < 2 ? (
          <Notice icon="search" title="Search for an organization" tc={tc} compact>
            Type at least two letters of its name. Public organizations can be followed by anyone.
          </Notice>
        ) : !settled ? (
          <Loading label="Searching…" tc={tc} compact />
        ) : results.failed ? (
          <Notice icon="alertTriangle" title="Search isn't available right now" tc={tc} compact>
            Please try again in a moment.
          </Notice>
        ) : results.list.length === 0 ? (
          <Notice icon="building" title="No public organization found" tc={tc} compact>
            Nothing matches &ldquo;{term}&rdquo;. If it is a private organization, open it with its code below.
          </Notice>
        ) : (
          <div className="space-y-2">
            {results.list.map((org) => (
              <OrgRow key={org.id} org={org} tc={tc} onOpen={() => onOpen(org)} />
            ))}
          </div>
        )}
      </section>

      <Section title="Open a private organization" tc={tc}>
        <form onSubmit={openPrivate} className={`space-y-3 rounded-xl border p-4 ${tc.card}`} noValidate autoComplete="off">
          {/* Decoy hidden inputs to prevent browser login autofill */}
          <input type="text" name="prevent_autofill_username" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} />
          <input type="password" name="prevent_autofill_password" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} />

          <p className={`flex items-start gap-2 text-xs ${tc.sub}`}>
            <Icon name="lock" size={14} className="mt-0.5" />
            Private organizations don&apos;t appear in search. Ask the organization for its code and access password.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organization code" tc={tc}>
              <TextInput
                tc={tc}
                name="org_access_code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="RW-7K3M9Q"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={12}
                className="font-mono tracking-wider"
              />
            </Field>
            <Field label="Access password" tc={tc}>
              <div className="relative">
                <TextInput
                  tc={tc}
                  name="org_access_password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={64}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${tc.sub}`}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </Field>
          </div>
          <ErrorNote message={error} tc={tc} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon="key" tc={tc} loading={opening}>
              Open
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
