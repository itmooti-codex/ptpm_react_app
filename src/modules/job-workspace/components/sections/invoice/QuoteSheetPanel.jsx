import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function toText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  const n = toNumber(value);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function parseBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const s = toText(value).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function normalizeActivity(activity) {
  const service = activity?.Service || activity?.service || {};
  const primaryService = service?.Primary_Service || service?.primary_service || {};
  return {
    id: toText(activity?.id || activity?.ID),
    task: toText(activity?.task || activity?.Task),
    option: toText(activity?.option || activity?.Option),
    serviceName: toText(service?.service_name || service?.Service_Name || activity?.service_name || activity?.Service_Service_Name),
    primaryServiceName: toText(primaryService?.service_name || primaryService?.Service_Name || activity?.Service_Service_Name1),
    quotedText: toText(activity?.quoted_text || activity?.Quoted_Text),
    warranty: toText(activity?.warranty || activity?.Warranty),
    note: toText(activity?.note || activity?.Note),
    quotedPrice: toNumber(activity?.quoted_price || activity?.Quoted_Price || activity?.activity_price || activity?.Activity_Price),
    includeInQuote: parseBool(activity?.include_in_quote ?? activity?.Include_in_Quote ?? activity?.Include_In_Quote),
    includeInQuoteSubtotal: parseBool(activity?.include_in_quote_subtotal ?? activity?.Include_in_Quote_Subtotal ?? activity?.Include_In_Quote_Subtotal),
    quoteAccepted: parseBool(activity?.quote_accepted ?? activity?.Quote_Accepted),
  };
}

function QuoteHeader({ data }) {
  if (!data) return null;
  const { logoUrl, accountName, accountType, workReqBy, workOrderUid, jobAddress, jobSuburb, date, residentsRows, feedback, recommendation } = data;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 font-sans text-sm text-slate-800">
      <div className="mb-3 flex items-center justify-between">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="max-h-14 max-w-[180px] object-contain" />
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div className="col-span-2 mb-1 text-center text-xl font-bold tracking-wide text-slate-900">JOB SHEET</div>
        {accountName ? <div><span className="font-semibold">Account Name:</span> {accountName}</div> : null}
        {accountType ? <div><span className="font-semibold">Account Type:</span> {accountType}</div> : null}
        {workReqBy ? <div><span className="font-semibold">Work Req. By:</span> {workReqBy}</div> : null}
        {workOrderUid ? <div><span className="font-semibold">Work Order #:</span> {workOrderUid}</div> : null}
        {jobAddress ? <div><span className="font-semibold">Job Address:</span> {jobAddress}</div> : null}
        {jobSuburb ? <div><span className="font-semibold">Job Suburb:</span> {jobSuburb}</div> : null}
        <div className="col-span-2 text-right text-slate-500"><span className="font-semibold">Date:</span> {date}</div>
      </div>

      <div className="border-y border-slate-300 py-1 text-xs font-bold">Resident&apos;s Details</div>
      <div className="mt-1 space-y-0.5 text-xs">
        {residentsRows && residentsRows.length ? (
          residentsRows.map((row, i) => <div key={i}>{row}</div>)
        ) : (
          <div>-</div>
        )}
      </div>

      {feedback ? (
        <>
          <div className="mt-2 border-y border-slate-300 py-1 text-center text-xs font-bold">Resident&apos;s Feedback</div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {feedback.animals ? <div><span className="font-semibold">Animals:</span> {feedback.animals}</div> : null}
            {feedback.renovations ? <div><span className="font-semibold">Renovations:</span> {feedback.renovations}</div> : null}
            {feedback.building ? <div><span className="font-semibold">Building:</span> {feedback.building}</div> : null}
            {feedback.times ? <div><span className="font-semibold">Times:</span> {feedback.times}</div> : null}
            {feedback.noises ? <div><span className="font-semibold">Noises:</span> {feedback.noises}</div> : null}
            {feedback.location ? <div><span className="font-semibold">Location:</span> {feedback.location}</div> : null}
            {feedback.resHrs ? <div><span className="font-semibold">Res. Hrs:</span> {feedback.resHrs}</div> : null}
            {feedback.stories ? <div><span className="font-semibold">Stories:</span> {feedback.stories}</div> : null}
            {feedback.buildingAge ? <div><span className="font-semibold">Building Age:</span> {feedback.buildingAge}</div> : null}
            {feedback.manhole ? <div><span className="font-semibold">Manhole?</span> {feedback.manhole}</div> : null}
          </div>
          {recommendation ? (
            <div className="mt-1.5 text-xs"><span className="font-semibold">Recommendations:</span> {recommendation}</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SignaturePad({ onAccept, onClear, isAccepted }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw(e) {
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  }

  function handleAccept() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onAccept(blob);
    }, "image/png");
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">Signature</div>
      <div
        className={`overflow-hidden rounded border-2 ${isAccepted ? "border-green-400 bg-green-50/30" : "border-slate-300 bg-white"}`}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="block w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          className="inline-flex h-8 items-center rounded border border-green-600 bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700"
        >
          Accept Signature
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-slate-400"
        >
          Clear Signature
        </button>
        {isAccepted ? (
          <span className="text-xs font-medium text-green-600">Signature accepted</span>
        ) : null}
      </div>
    </div>
  );
}

const tableHeaderCellClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const tableBodyCellClass = "px-3 py-2 text-sm align-top";

export function QuoteSheetPanel({ activities, headerData, onAcceptQuote, isAcceptingQuote, canAcceptQuote }) {
  const normalized = useMemo(
    () => (Array.isArray(activities) ? activities : []).map(normalizeActivity),
    [activities]
  );

  const quoteActivities = useMemo(
    () => normalized.filter((a) => a.includeInQuote),
    [normalized]
  );

  // One activity selected per task group (same behaviour as Client Invoice).
  // Pre-select the activity with includeInQuoteSubtotal=true per task; if none,
  // select the first activity in each task group.
  const initialSelectedIds = useMemo(() => {
    const byTask = new Map();
    for (const a of quoteActivities) {
      const key = a.task || "(No Task)";
      if (!byTask.has(key)) byTask.set(key, []);
      byTask.get(key).push(a);
    }
    const ids = [];
    for (const acts of byTask.values()) {
      const subtotalPick = acts.find((a) => a.includeInQuoteSubtotal);
      ids.push(subtotalPick ? subtotalPick.id : acts[0].id);
    }
    return ids;
  }, [quoteActivities]);

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);

  const activityIdKey = quoteActivities.map((a) => a.id).join(",");
  useEffect(() => {
    setSelectedIds(initialSelectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityIdKey]);

  function toggleActivity(id, checked) {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      if (!checked) {
        prevSet.delete(id);
        return Array.from(prevSet);
      }
      // Find the task group of the newly checked activity and deselect
      // any existing selection in the same group (one-per-task rule).
      const target = quoteActivities.find((a) => a.id === id);
      const targetTask = target?.task || "";
      const next = prev.filter((existingId) => {
        const existing = quoteActivities.find((a) => a.id === existingId);
        return (existing?.task || "") !== targetTask;
      });
      next.push(id);
      return next;
    });
  }

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const { selectedTotal, gst } = useMemo(() => {
    let total = 0;
    for (const a of quoteActivities) {
      if (selectedIdSet.has(a.id)) total += a.quotedPrice;
    }
    return { selectedTotal: total, gst: total / 11 };
  }, [quoteActivities, selectedIdSet]);

  // Accept flow state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSignatureAccepted, setIsSignatureAccepted] = useState(false);
  const [signatureBlob, setSignatureBlob] = useState(null);

  const canSubmit = canAcceptQuote && termsAccepted && isSignatureAccepted && !isAcceptingQuote;

  function handleSignatureAccept(blob) {
    setSignatureBlob(blob);
    setIsSignatureAccepted(true);
  }

  function handleSignatureClear() {
    setSignatureBlob(null);
    setIsSignatureAccepted(false);
  }

  const handleAccept = useCallback(() => {
    if (!canSubmit) return;
    onAcceptQuote({ signatureBlob });
  }, [canSubmit, onAcceptQuote, signatureBlob]);

  return (
    <div className="space-y-4">
      <QuoteHeader data={headerData} />

      {/* Activities table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {quoteActivities.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No activities have been added to the quote yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-100/90">
                <tr>
                  <th className={`w-10 ${tableHeaderCellClass}`}></th>
                  <th className={`w-[120px] ${tableHeaderCellClass}`}>Task</th>
                  <th className={`w-[130px] ${tableHeaderCellClass}`}>Option</th>
                  <th className={tableHeaderCellClass}>Service</th>
                  <th className={`w-[120px] text-right ${tableHeaderCellClass}`}>Quoted Price</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {quoteActivities.map((activity) => {
                  const serviceLabel = [activity.serviceName, activity.primaryServiceName].filter(Boolean).join(" - ");
                  const checked = selectedIdSet.has(activity.id);
                  return (
                    <tr
                      key={activity.id}
                      className="transition-colors hover:bg-slate-50/65"
                    >
                      <td className={tableBodyCellClass}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-[#0A3E8C]"
                          checked={checked}
                          onChange={(e) => toggleActivity(activity.id, e.target.checked)}
                        />
                      </td>
                      <td className={`${tableBodyCellClass} text-slate-800`}>
                        {activity.task || "-"}
                      </td>
                      <td className={`${tableBodyCellClass} text-slate-800`}>
                        {activity.option || "-"}
                      </td>
                      <td className={`${tableBodyCellClass} text-slate-800`}>
                        <div>{serviceLabel || "-"}</div>
                        {activity.quotedText ? <div className="mt-0.5 text-xs text-slate-500">{activity.quotedText}</div> : null}
                        {activity.warranty ? <div className="mt-0.5 text-xs text-slate-500"><span className="font-medium">Warranty:</span> {activity.warranty}</div> : null}
                        {activity.note ? <div className="mt-0.5 text-xs text-slate-500"><span className="font-medium">Note:</span> {activity.note}</div> : null}
                      </td>
                      <td className={`${tableBodyCellClass} text-right font-semibold text-slate-900`}>
                        {formatCurrency(activity.quotedPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>GST</span>
            <span>{formatCurrency(gst)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-slate-800">
            <span>Quote Total Inclusive GST</span>
            <span>{formatCurrency(selectedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Accept flow */}
      {canAcceptQuote ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          {/* T&C checkbox */}
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#0A3E8C]"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              I accept the{" "}
              <a
                href="https://my.awesomate.pro/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 underline underline-offset-2 hover:text-sky-700"
              >
                terms and conditions
              </a>
            </span>
          </label>

          {/* Signature pad */}
          <SignaturePad
            onAccept={handleSignatureAccept}
            onClear={handleSignatureClear}
            isAccepted={isSignatureAccepted}
          />

          {/* Accept Quote button */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded border border-sky-700 bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleAccept}
              disabled={!canSubmit}
            >
              {isAcceptingQuote ? "Accepting..." : "Accept Quote"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
