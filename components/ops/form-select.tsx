"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FormSelect({
  name,
  defaultValue,
  placeholder,
  options,
  required,
  disabled,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");

  const handleChange = (next: string) => {
    setValue(next);
    onValueChange?.(next);
  };

  return (
    <>
      <input type="hidden" name={name} value={value} required={required && !value} />
      <Select value={value || undefined} onValueChange={handleChange} disabled={disabled || options.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? "Select..."} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
