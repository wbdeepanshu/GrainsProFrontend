export default function BrandDatePicker({ value, onChange, className = "", disabled = false, ...props }) {
  return (
    <input
      type="date"
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={
        className ||
        "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
      }
      {...props}
    />
  );
}
