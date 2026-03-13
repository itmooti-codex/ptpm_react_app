import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { ColorSelectField } from "../../../../shared/components/ui/ColorSelectField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import {
  JobDirectCardFormPanel,
  JobDirectFormActionsRow,
} from "../primitives/WorkspaceLayoutPrimitives.jsx";
import { ACTIVITY_STATUS_OPTIONS } from "../../constants/options.js";

export function ActivitiesFormPanel({
  form,
  setForm,
  isEditing,
  isSubmitting,
  taskOptions,
  optionOptions,
  primaryServices,
  secondaryOptions,
  handlePrimaryServiceChange,
  handleOptionServiceChange,
  handleSubmit,
  resetForm,
}) {
  return (
    <JobDirectCardFormPanel title={isEditing ? "Edit Activity" : "Add New Activity"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Task"
            data-field="task"
            value={form.task}
            onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
            options={taskOptions}
          />
          <SelectField
            label="Options"
            data-field="option"
            value={form.option}
            onChange={(event) => setForm((prev) => ({ ...prev, option: event.target.value }))}
            options={optionOptions}
          />
          <SelectField
            label="Primary Service"
            data-field="service_name"
            value={form.primaryServiceId}
            onChange={handlePrimaryServiceChange}
            options={primaryServices.map((service) => ({
              value: service.id,
              label: service.name,
            }))}
          />
          <InputField
            label="Quantity"
            data-field="quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, quantity: event.target.value }))
            }
          />
          {secondaryOptions.length ? (
            <SelectField
              label="Option Service"
              value={form.optionServiceId}
              onChange={handleOptionServiceChange}
              options={secondaryOptions.map((service) => ({
                value: service.id,
                label: service.name,
              }))}
            />
          ) : (
            <div />
          )}
          <InputField
            label="Activity Price"
            data-field="activity_price"
            placeholder="$ 0.00"
            value={form.activity_price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, activity_price: event.target.value }))
            }
          />
          <ColorSelectField
            label="Activity Status"
            data-field="activity_status"
            value={form.activity_status}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, activity_status: event.target.value }))
            }
            options={ACTIVITY_STATUS_OPTIONS}
          />
          <InputField
            label="Date Required"
            type="date"
            data-field="date_required"
            value={form.date_required}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, date_required: event.target.value }))
            }
          />
        </div>

        <TextareaField
          label="Activity Text"
          rows={2}
          data-field="activity_text"
          value={form.activity_text}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, activity_text: event.target.value }))
          }
        />
        <TextareaField
          label="Warranty"
          rows={2}
          data-field="warranty"
          value={form.warranty}
          onChange={(event) => setForm((prev) => ({ ...prev, warranty: event.target.value }))}
        />
        <TextareaField
          label="Note"
          rows={2}
          data-field="note"
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
        />

        <div className="grid grid-cols-1 gap-2">
          <CheckboxField
            data-field="invoice_to_client"
            label="Invoice to client"
            checked={form.invoice_to_client}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, invoice_to_client: event.target.checked }))
            }
          />
          <CheckboxField
            data-field="include_in_quote_subtotal"
            label="Include in quote subtotal"
            checked={form.include_in_quote_subtotal}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                include_in_quote_subtotal: event.target.checked,
              }))
            }
          />
          <CheckboxField
            data-field="include_in_quote"
            label="Include in quote"
            checked={form.include_in_quote}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, include_in_quote: event.target.checked }))
            }
          />
        </div>

        <JobDirectFormActionsRow>
          <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEditing ? "Update" : "Add"}
          </Button>
        </JobDirectFormActionsRow>
      </form>
    </JobDirectCardFormPanel>
  );
}
