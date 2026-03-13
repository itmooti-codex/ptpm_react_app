import { useState, useEffect, useRef, useCallback } from "react";
import { searchContactsForLookup, searchCompaniesForLookup } from "@modules/details-workspace/exports/api.js";
import { AUSTRALIAN_STATE_OPTIONS } from "@shared/constants/locationOptions.js";
import { toText } from "@shared/utils/formatters.js";

function buildGoogleMapsUrl(address, city, state, postalCode) {
  const parts = [address, city, state, postalCode].filter(Boolean);
  if (!parts.length) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

function fieldBorderClass(value, touched) {
  if (toText(value)) return "border-green-400 focus:border-green-500";
  if (touched) return "border-orange-400 focus:border-orange-500";
  return "border-slate-300 focus:border-slate-400";
}

function FormField({ label, required, value, touched, inputRef, ...rest }) {
  return (
    <label className="block">
      <span className="type-label text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-orange-500">*</span> : null}
      </span>
      <input
        ref={inputRef}
        className={`mt-2 w-full rounded border ${fieldBorderClass(value, touched)} bg-white px-3 py-2 text-sm text-slate-700 outline-none`}
        value={value}
        {...rest}
      />
    </label>
  );
}

function SelectFormField({ label, required, value, touched, options, ...rest }) {
  return (
    <label className="block">
      <span className="type-label text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-orange-500">*</span> : null}
      </span>
      <select
        className={`mt-2 w-full rounded border ${fieldBorderClass(value, touched)} bg-white px-3 py-2 text-sm text-slate-700 outline-none`}
        value={value}
        {...rest}
      >
        <option value="">Select state</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MapsLink({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 underline underline-offset-2"
    >
      View on Google Maps ↗
    </a>
  );
}

export function QuickInquiryAccountStep({
  accountMode,
  companyAddressLookupRef,
  companyForm,
  companyMatchState,
  contactMatchState,
  individualAddressLookupRef,
  individualForm,
  matchMessageClassByStatus,
  plugin,
  setAccountMode,
  setCompanyForm,
  setCompanyMatchState,
  setContactMatchState,
  setIndividualForm,
}) {
  const [touched, setTouched] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = searchQuery.trim();
    if (!trimmed || !plugin) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      const searchFn = accountMode === "company" ? searchCompaniesForLookup : searchContactsForLookup;
      searchFn({ plugin, query: trimmed, limit: 10 })
        .then((results) => { setSearchResults(Array.isArray(results) ? results : []); })
        .catch(() => { setSearchResults([]); })
        .finally(() => { setIsSearching(false); });
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, plugin, accountMode]);

  const touch = useCallback((field) => {
    setTouched((prev) => { const next = new Set(prev); next.add(field); return next; });
  }, []);

  const handleContactSelect = useCallback((record) => {
    setIndividualForm((prev) => ({
      ...prev,
      email: toText(record?.email || record?.Email || prev.email),
      first_name: toText(record?.first_name || record?.First_Name || prev.first_name),
      last_name: toText(record?.last_name || record?.Last_Name || prev.last_name),
      sms_number: toText(record?.sms_number || record?.SMS_Number || prev.sms_number),
      address: toText(record?.address || record?.Address || prev.address),
      city: toText(record?.city || record?.City || prev.city),
      state: toText(record?.state || record?.State || prev.state),
      zip_code: toText(record?.zip_code || record?.Zip_Code || prev.zip_code),
    }));
    setContactMatchState({ status: "found", message: "Contact matched and prefilled.", record });
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownOpen(false);
  }, [setIndividualForm, setContactMatchState]);

  const handleCompanySelect = useCallback((record) => {
    const pp = record?.Primary_Person || record?.primary_person || {};
    setCompanyForm((prev) => ({
      ...prev,
      company_name: toText(record?.name || record?.Name || prev.company_name),
      company_phone: toText(record?.phone || record?.Phone || prev.company_phone),
      company_address: toText(record?.address || record?.Address || prev.company_address),
      company_city: toText(record?.city || record?.City || prev.company_city),
      company_state: toText(record?.state || record?.State || prev.company_state),
      company_postal_code: toText(record?.postal_code || record?.Postal_Code || prev.company_postal_code),
      company_account_type: toText(record?.account_type || record?.Account_Type || prev.company_account_type),
      primary_first_name: toText(pp?.first_name || pp?.First_Name || prev.primary_first_name),
      primary_last_name: toText(pp?.last_name || pp?.Last_Name || prev.primary_last_name),
      primary_email: toText(pp?.email || pp?.Email || prev.primary_email),
      primary_sms_number: toText(pp?.sms_number || pp?.SMS_Number || prev.primary_sms_number),
    }));
    setCompanyMatchState({ status: "found", message: "Company matched and prefilled.", record });
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownOpen(false);
  }, [setCompanyForm, setCompanyMatchState]);

  const individualMapsUrl = buildGoogleMapsUrl(
    individualForm.address, individualForm.city, individualForm.state, individualForm.zip_code
  );
  const companyMapsUrl = buildGoogleMapsUrl(
    companyForm.company_address, companyForm.company_city, companyForm.company_state, companyForm.company_postal_code
  );

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Are you an individual or company?
      </div>
      <div className="mb-3 inline-flex rounded border border-slate-300 p-0.5">
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs font-semibold ${accountMode === "individual" ? "bg-[#003882] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          onClick={() => setAccountMode("individual")}
        >
          Individual
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs font-semibold ${accountMode === "company" ? "bg-[#003882] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          onClick={() => setAccountMode("company")}
        >
          Company
        </button>
      </div>

      {/* Search dropdown */}
      <div className="relative mb-3" ref={dropdownRef}>
        <label className="block">
          <span className="type-label text-slate-600">
            {accountMode === "company" ? "Search Companies" : "Search Contacts"}
          </span>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            placeholder={accountMode === "company" ? "Search by name, contact name, email..." : "Search by name, email, phone or address..."}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
            onFocus={() => { if (searchQuery) setIsDropdownOpen(true); }}
          />
        </label>
        {isDropdownOpen && (isSearching || searchResults.length > 0) ? (
          <div className="absolute z-20 mt-1 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg" style={{ maxHeight: "220px" }}>
            {isSearching ? (
              <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>
            ) : accountMode === "company" ? (
              searchResults.map((result) => {
                const name = toText(result?.name || result?.Name);
                const accountType = toText(result?.account_type || result?.Account_Type);
                const pp = result?.Primary_Person || result?.primary_person || {};
                const ppName = [toText(pp?.first_name || pp?.First_Name), toText(pp?.last_name || pp?.Last_Name)].filter(Boolean).join(" ");
                const ppEmail = toText(pp?.email || pp?.Email);
                return (
                  <button
                    key={toText(result?.id || result?.ID)}
                    type="button"
                    className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                    onMouseDown={(e) => { e.preventDefault(); handleCompanySelect(result); }}
                  >
                    <div className="text-sm font-medium text-slate-800">
                      {name || "(no name)"}{accountType ? ` · ${accountType}` : ""}
                    </div>
                    {(ppName || ppEmail) ? (
                      <div className="text-xs text-slate-500">{[ppName, ppEmail].filter(Boolean).join(" · ")}</div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              searchResults.map((result) => {
                const fullName = [toText(result?.first_name || result?.First_Name), toText(result?.last_name || result?.Last_Name)].filter(Boolean).join(" ");
                const email = toText(result?.email || result?.Email);
                const phone = toText(result?.sms_number || result?.SMS_Number);
                const address = toText(result?.address || result?.Address);
                return (
                  <button
                    key={toText(result?.id || result?.ID)}
                    type="button"
                    className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                    onMouseDown={(e) => { e.preventDefault(); handleContactSelect(result); }}
                  >
                    <div className="text-sm font-medium text-slate-800">
                      {fullName || "(no name)"}{email ? ` · ${email}` : ""}
                    </div>
                    {(phone || address) ? (
                      <div className="text-xs text-slate-500">{[phone, address].filter(Boolean).join(" · ")}</div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* Match state messages */}
      {accountMode === "individual" && contactMatchState.message ? (
        <div className={`mb-2 text-xs ${matchMessageClassByStatus[contactMatchState.status] || "text-slate-500"}`}>
          {contactMatchState.message}
        </div>
      ) : null}
      {accountMode === "company" && companyMatchState.message ? (
        <div className={`mb-2 text-xs ${matchMessageClassByStatus[companyMatchState.status] || "text-slate-500"}`}>
          {companyMatchState.message}
        </div>
      ) : null}

      {/* Individual form */}
      {accountMode === "individual" ? (
        <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
          <FormField
            label="First Name"
            required
            field="quick_individual_first_name"
            value={individualForm.first_name}
            touched={touched.has("first_name")}
            onBlur={() => touch("first_name")}
            onChange={(e) => { touch("first_name"); setIndividualForm((p) => ({ ...p, first_name: e.target.value })); }}
          />
          <FormField
            label="Last Name"
            required
            field="quick_individual_last_name"
            value={individualForm.last_name}
            touched={touched.has("last_name")}
            onBlur={() => touch("last_name")}
            onChange={(e) => { touch("last_name"); setIndividualForm((p) => ({ ...p, last_name: e.target.value })); }}
          />
          <FormField
            label="SMS Number"
            required
            field="quick_individual_phone"
            value={individualForm.sms_number}
            touched={touched.has("sms_number")}
            onBlur={() => touch("sms_number")}
            onChange={(e) => { touch("sms_number"); setIndividualForm((p) => ({ ...p, sms_number: e.target.value })); }}
          />
          <FormField
            label="Email"
            required
            field="quick_individual_email"
            value={individualForm.email}
            touched={touched.has("email")}
            onBlur={() => touch("email")}
            onChange={(e) => { touch("email"); setIndividualForm((p) => ({ ...p, email: e.target.value })); }}
            placeholder="Enter email"
          />
          <div className="sm:col-span-2">
            <FormField
              label="Address (Google Lookup)"
              field="quick_individual_address"
              inputRef={individualAddressLookupRef}
              value={individualForm.address}
              touched={false}
              onChange={(e) => setIndividualForm((p) => ({ ...p, address: e.target.value }))}
            />
            <MapsLink url={individualMapsUrl} />
          </div>
          <FormField
            label="City"
            field="quick_individual_city"
            value={individualForm.city}
            touched={false}
            onChange={(e) => setIndividualForm((p) => ({ ...p, city: e.target.value }))}
          />
          <SelectFormField
            label="State"
            field="quick_individual_state"
            value={individualForm.state}
            touched={false}
            options={AUSTRALIAN_STATE_OPTIONS}
            onChange={(e) => setIndividualForm((p) => ({ ...p, state: e.target.value }))}
          />
          <FormField
            label="Postal Code"
            field="quick_individual_zip_code"
            value={individualForm.zip_code}
            touched={false}
            onChange={(e) => setIndividualForm((p) => ({ ...p, zip_code: e.target.value }))}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              label="Company Name"
              required
              field="quick_company_name"
              value={companyForm.company_name}
              touched={touched.has("company_name")}
              onBlur={() => touch("company_name")}
              onChange={(e) => { touch("company_name"); setCompanyForm((p) => ({ ...p, company_name: e.target.value })); }}
              placeholder="Enter company name"
            />
          </div>
          <FormField
            label="Phone"
            field="quick_company_phone"
            value={companyForm.company_phone}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, company_phone: e.target.value }))}
          />
          <FormField
            label="Account Type"
            field="quick_company_account_type"
            value={companyForm.company_account_type}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, company_account_type: e.target.value }))}
            placeholder="Business / Body Corp / Other"
          />
          <div className="sm:col-span-2">
            <FormField
              label="Address (Google Lookup)"
              field="quick_company_address"
              inputRef={companyAddressLookupRef}
              value={companyForm.company_address}
              touched={false}
              onChange={(e) => setCompanyForm((p) => ({ ...p, company_address: e.target.value }))}
            />
            <MapsLink url={companyMapsUrl} />
          </div>
          <FormField
            label="City"
            field="quick_company_city"
            value={companyForm.company_city}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, company_city: e.target.value }))}
          />
          <SelectFormField
            label="State"
            field="quick_company_state"
            value={companyForm.company_state}
            touched={false}
            options={AUSTRALIAN_STATE_OPTIONS}
            onChange={(e) => setCompanyForm((p) => ({ ...p, company_state: e.target.value }))}
          />
          <FormField
            label="Postal Code"
            field="quick_company_postal_code"
            value={companyForm.company_postal_code}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, company_postal_code: e.target.value }))}
          />
          <FormField
            label="Primary First Name"
            field="quick_company_primary_first_name"
            value={companyForm.primary_first_name}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, primary_first_name: e.target.value }))}
          />
          <FormField
            label="Primary Last Name"
            field="quick_company_primary_last_name"
            value={companyForm.primary_last_name}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, primary_last_name: e.target.value }))}
          />
          <FormField
            label="Primary Email"
            field="quick_company_primary_email"
            value={companyForm.primary_email}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, primary_email: e.target.value }))}
          />
          <FormField
            label="Primary Phone"
            field="quick_company_primary_phone"
            value={companyForm.primary_sms_number}
            touched={false}
            onChange={(e) => setCompanyForm((p) => ({ ...p, primary_sms_number: e.target.value }))}
          />
        </div>
      )}
    </div>
  );
}
