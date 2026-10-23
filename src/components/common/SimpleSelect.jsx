export default function SimpleSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select",
  disabled = false,
  className = "",
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={
        className ||
        "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
      }
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((opt) => {
        const val = typeof opt === "object" ? opt.value : opt;
        const label = typeof opt === "object" ? opt.label : opt;
        return (
          <option key={String(val)} value={val}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
