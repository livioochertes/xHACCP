import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { frenchDepartments, searchFrenchDepartments } from "@/utils/location-data";

interface FrenchDepartmentSelectProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  onValueChange: (code: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}

const FrenchDepartmentSelect = forwardRef<HTMLButtonElement, FrenchDepartmentSelectProps>(
  function FrenchDepartmentSelect(
    {
      value,
      onValueChange,
      placeholder,
      searchPlaceholder,
      noResultsLabel,
      className,
      ...buttonProps
    },
    ref,
  ) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedDepartment = frenchDepartments.find((department) => department.code === value);
  const filteredDepartments = searchFrenchDepartments(search);

  const closePopover = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={closePopover}>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">
            {selectedDepartment
              ? `${selectedDepartment.code} — ${selectedDepartment.name}`
              : value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{noResultsLabel}</CommandEmpty>
            <CommandGroup>
              {filteredDepartments.map((department) => (
                <CommandItem
                  key={department.code}
                  value={`${department.code} ${department.name}`}
                  onSelect={() => {
                    onValueChange(department.code);
                    closePopover(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === department.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {department.code} — {department.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
  },
);

FrenchDepartmentSelect.displayName = "FrenchDepartmentSelect";

export default FrenchDepartmentSelect;
