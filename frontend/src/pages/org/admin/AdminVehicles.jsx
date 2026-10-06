// ============================================================
// AdminVehicles — the fleet (Vehicles tab)
//
//   add a vehicle (a short code, its kind, registration, seats)
//   edit it
//   change its status: Active · Servicing · Repair · Retired
//   remove it
//
// TWO RULES THE SERVER ENFORCES (and this screen explains)
//   • a vehicle that is out on a trip cannot be taken out of "Active" or
//     removed — end the trip first
//   • removing a vehicle that has trip history RETIRES it instead: its
//     past trips must keep the vehicle they belong to
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLoad, useNow } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button, { Chip, IconButton } from "../../components/ui/Button";
import {
  Badge, ConfirmButton, ErrorNote, Field, LiveDot, LoadError, Loading, Modal, Notice, Section, TextArea, TextInput,
} from "../../components/org/kit";
import {
  VEHICLE_STATUSES, VEHICLE_TYPES, parseTime, plural, stampVehicles, timeAgo, vehicleStatus, vehicleType,
} from "../../components/org/fleetUi";
import {
  addVehicle, getVehicles, removeVehicle, setVehicleStatus, updateVehicle,
} from "../../../services/orgApi";

export default function AdminVehicles({ orgId, tc }) {
  const now = useNow(30_000);
  const fleet = useLoad(`admin-vehicles-${orgId}`, async () => stampVehicles(await getVehicles(orgId)));
  const [editing, setEditing] = useState(null);   // a vehicle, or {} for a new one
  const [busyId, setBusyId] = useState(null);

  const { inUse, retired } = useMemo(() => {
    const list = fleet.data || [];
    return {
      inUse: list.filter((vehicle) => vehicle.status !== "RETIRED"),
      retired: list.filter((vehicle) => vehicle.status === "RETIRED"),
    };
  }, [fleet.data]);

  const changeStatus = async (vehicle, status) => {
    if (status === vehicle.status) return;
    setBusyId(vehicle.id);
    try {
      await setVehicleStatus(orgId, vehicle.id, status);
      toast.success(`${vehicle.vehicleCode} is now ${vehicleStatus(status).label.toLowerCase()}.`);
      fleet.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't change the status.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (vehicle) => {
    try {
      const answer = await removeVehicle(orgId, vehicle.id);
      if (answer?.deleted) toast.success(`${vehicle.vehicleCode} removed.`);
      else toast.info(`${vehicle.vehicleCode} has trip history, so it was retired instead of deleted.`);
      fleet.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't remove the vehicle.");
    }
  };

  if (fleet.loading) return <Loading label="Loading the vehicles…" tc={tc} />;
  if (!fleet.data) return <LoadError error={fleet.error} onRetry={fleet.reload} tc={tc} />;

  return (
    <div className="space-y-8">
      <Section
        title="Vehicles"
        count={inUse.length}
        tc={tc}
        action={<Button variant="primary" size="sm" icon="plus" tc={tc} onClick={() => setEditing({})}>Add vehicle</Button>}
      >
        {inUse.length === 0 ? (
          <Notice icon="bus" title="Add your first vehicle" tc={tc}
            action={<Button variant="primary" icon="plus" tc={tc} onClick={() => setEditing({})}>Add vehicle</Button>}>
            Give it the code your people already use — &ldquo;BUS-01&rdquo;, &ldquo;Route 7&rdquo;, &ldquo;Ambulance 2&rdquo;.
            Drivers choose it by that code and passengers search for it.
          </Notice>
        ) : (
          <div className="space-y-2">
            {inUse.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                now={now}
                tc={tc}
                busy={busyId === vehicle.id}
                onEdit={() => setEditing(vehicle)}
                onStatus={(status) => changeStatus(vehicle, status)}
                onRemove={() => remove(vehicle)}
              />
            ))}
          </div>
        )}
      </Section>

      {retired.length > 0 && (
        <Section title="Retired" count={retired.length} tc={tc}>
          <div className="space-y-2">
            {retired.map((vehicle) => (
              <div key={vehicle.id} className={`flex items-center gap-3 rounded-xl border p-3.5 opacity-80 ${tc.card}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                  <Icon name={vehicleType(vehicle.vehicleType).icon} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{vehicle.vehicleCode}</p>
                  <p className={`truncate text-xs ${tc.sub}`}>Kept for its trip history. Hidden from everyone but admins.</p>
                </div>
                <Button variant="secondary" size="sm" icon="refresh" tc={tc} loading={busyId === vehicle.id}
                  onClick={() => changeStatus(vehicle, "ACTIVE")}>
                  Bring back
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {editing && (
        <VehicleModal
          tc={tc}
          orgId={orgId}
          vehicle={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fleet.reload(); }}
        />
      )}
    </div>
  );
}

// ── One vehicle, with its controls ───────────────────────────
function VehicleCard({ vehicle, now, tc, busy, onEdit, onStatus, onRemove }) {
  const type = vehicleType(vehicle.vehicleType);
  const onTrip = Boolean(vehicle.trip);
  const seen = parseTime(vehicle.lastLocationAt);
  const details = [
    type.label,
    vehicle.registrationNumber,
    vehicle.capacity ? plural(vehicle.capacity, "seat") : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`rounded-xl border p-3.5 ${tc.card}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
          onTrip ? tc.okSoft : `${tc.surface2} ${tc.divider}`}`}>
          <Icon name={type.icon} size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold">{vehicle.vehicleCode}</span>
            {onTrip && <Badge tone="ok" tc={tc}><LiveDot />With {vehicle.trip.driverName}</Badge>}
          </p>
          <p className={`truncate text-xs ${tc.sub}`}>
            {details}
            {!onTrip && seen != null ? ` · last out ${timeAgo(seen, now)}` : ""}
          </p>
        </div>
        <IconButton icon="edit" label={`Edit ${vehicle.vehicleCode}`} size="sm" tc={tc} onClick={onEdit} />
        <ConfirmButton label="Remove" confirmLabel="Remove" icon="trash" iconOnly variant="ghost" tc={tc}
          title={onTrip ? "End its trip before removing it" : `Remove ${vehicle.vehicleCode}`}
          disabled={onTrip} onConfirm={onRemove} />
      </div>

      {vehicle.description && <p className={`mt-2 text-xs ${tc.sub}`}>{vehicle.description}</p>}

      {/* Status — one tap. Locked while the vehicle is out. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`Status of ${vehicle.vehicleCode}`}>
        {VEHICLE_STATUSES.filter((status) => status.id !== "RETIRED").map((status) => (
          <Chip
            key={status.id}
            selected={vehicle.status === status.id}
            tc={tc}
            icon={status.id === "REPAIR" ? "wrench" : undefined}
            disabled={busy || (onTrip && status.id !== "ACTIVE")}
            title={onTrip && status.id !== "ACTIVE" ? "End its trip first" : status.hint}
            onClick={() => onStatus(status.id)}
          >
            {status.label}
          </Chip>
        ))}
        {onTrip && <span className={`text-[11px] ${tc.sub}`}>On a trip — end it to change the status.</span>}
      </div>
    </div>
  );
}

// ── Add / edit ───────────────────────────────────────────────
function VehicleModal({ tc, orgId, vehicle, onClose, onSaved }) {
  const [code, setCode] = useState(vehicle?.vehicleCode || "");
  const [type, setType] = useState(vehicle?.vehicleType || "BUS");
  const [registration, setRegistration] = useState(vehicle?.registrationNumber || "");
  const [capacity, setCapacity] = useState(vehicle?.capacity ? String(vehicle.capacity) : "");
  const [description, setDescription] = useState(vehicle?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (!code.trim()) { setError("Give the vehicle a code, such as BUS-01."); return; }
    const seats = capacity.trim() === "" ? 0 : Number(capacity);
    if (!Number.isInteger(seats) || seats < 0 || seats > 500) { setError("Seats must be a number up to 500."); return; }

    const body = {
      vehicleCode: code.trim(),
      vehicleType: type,
      registrationNumber: registration.trim(),
      capacity: seats,
      description: description.trim(),
    };
    setSaving(true);
    try {
      if (vehicle) await updateVehicle(orgId, vehicle.id, body);
      else await addVehicle(orgId, body);
      toast.success(vehicle ? `${body.vehicleCode} updated.` : `${body.vehicleCode} added — drivers can take it out now.`);
      onSaved();
    } catch (err) {
      setError(err.message || "Couldn't save the vehicle.");
      setSaving(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="bus"
      title={vehicle ? `Edit ${vehicle.vehicleCode}` : "Add a vehicle"}
      onClose={onClose}
      busy={saving}
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field label="Code" tc={tc} hint="Short and familiar — it is what drivers pick and passengers look for.">
          <TextInput tc={tc} value={code} onChange={(event) => setCode(event.target.value)}
            placeholder="BUS-01" maxLength={20} autoFocus />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-semibold">Kind</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of vehicle">
            {VEHICLE_TYPES.map((option) => (
              <Chip key={option.id} type="button" icon={option.icon} selected={type === option.id} tc={tc}
                onClick={() => setType(option.id)}>
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration number" optional tc={tc}>
            <TextInput tc={tc} value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())}
              placeholder="TN 09 AB 1234" maxLength={20} />
          </Field>
          <Field label="Seats" optional tc={tc}>
            <TextInput tc={tc} type="number" inputMode="numeric" min={0} max={500} value={capacity}
              onChange={(event) => setCapacity(event.target.value)} placeholder="40" />
          </Field>
        </div>

        <Field label="Notes" optional tc={tc} hint="Only admins see this.">
          <TextArea tc={tc} value={description} onChange={(event) => setDescription(event.target.value)}
            placeholder="AC coach, wheelchair lift…" maxLength={300} rows={2} />
        </Field>

        <ErrorNote message={error} tc={tc} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" tc={tc} disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon="check" tc={tc} loading={saving}>
            {vehicle ? "Save" : "Add vehicle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
