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
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} required={required && !value} />
      <Select value={value || undefined} onValueChange={setValue} disabled={disabled || options.length === 0}>
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
