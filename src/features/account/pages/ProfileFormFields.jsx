const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

export { STATE_OPTIONS };

export function ProfileFormFields({ form, setForm }) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Basic Details
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Display Name
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.displayName}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, displayName: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              SMS Number
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.smsNumber}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, smsNumber: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              First Name
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.firstName}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, firstName: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Name
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.lastName}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, lastName: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </span>
            <input
              type="email"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, email: event.target.value }))
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Address Details
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Lot Number
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.lotNumber}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, lotNumber: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Unit Number
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.unitNumber}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, unitNumber: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Address
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.address}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, address: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Address 2
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.address2}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, address2: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              City
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.city}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, city: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              State
            </span>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.state}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, state: event.target.value }))
              }
            >
              <option value="">Select state</option>
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Zip Code
            </span>
            <input
              type="text"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
              value={form.zipCode}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, zipCode: event.target.value }))
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          About
        </h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Bio
          </span>
          <textarea
            rows={4}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
            value={form.bio}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, bio: event.target.value }))
            }
          />
        </label>
      </section>
    </div>
  );
}
