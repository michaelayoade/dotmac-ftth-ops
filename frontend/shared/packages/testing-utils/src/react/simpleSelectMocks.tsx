import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectContextValue {
  value: string;
  setValue: (value: string) => void;
  registerOption: (option: SelectOption) => void;
  unregisterOption: (value: string) => void;
  options: SelectOption[];
}

const extractText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join(" ").trim();
  }
  if (React.isValidElement(node)) {
    return extractText(node.props.children);
  }
  return "";
};

export const createSimpleSelectMockComponents = () => {
  const SelectContext = createContext<SelectContextValue | null>(null);

  const Select = ({
    children,
    value,
    defaultValue,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
  }) => {
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const [options, setOptions] = useState<SelectOption[]>([]);

    const setValue = useCallback(
      (nextValue: string) => {
        if (value === undefined) {
          setInternalValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
      [value, onValueChange],
    );

    const registerOption = useCallback((option: SelectOption) => {
      setOptions((prev) => {
        const existingIndex = prev.findIndex((opt) => opt.value === option.value);
        if (existingIndex === -1) {
          return [...prev, option];
        }
        const existing = prev[existingIndex];
        if (existing.label === option.label) {
          return prev;
        }
        const next = [...prev];
        next[existingIndex] = option;
        return next;
      });
    }, []);

    const unregisterOption = useCallback((optionValue: string) => {
      setOptions((prev) => prev.filter((opt) => opt.value !== optionValue));
    }, []);

    const contextValue = useMemo(
      () => ({
        value: value ?? internalValue,
        setValue,
        registerOption,
        unregisterOption,
        options,
      }),
      [value, internalValue, setValue, registerOption, unregisterOption, options],
    );

    return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
  };

  const SelectTrigger = ({
    id,
    children: _children,
    ...props
  }: {
    id?: string;
    children?: ReactNode;
  }) => {
    const context = useContext(SelectContext);

    if (!context) {
      return <select id={id} {...props} />;
    }

    return (
      <select
        id={id}
        value={context.value ?? ""}
        onChange={(event) => context.setValue(event.target.value)}
        {...props}
      >
        {context.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children: ReactNode }) => <>{children}</>;
  const SelectValue = () => null;

  const SelectItem = ({ value, children }: { value: string; children: ReactNode }) => {
    const context = useContext(SelectContext);

    useEffect(() => {
      if (!context) return;
      const label = extractText(children) || String(value);
      context.registerOption({ value, label });
      return () => context.unregisterOption(value);
    }, [context?.registerOption, context?.unregisterOption, value, children]);

    return null;
  };

  return {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
  };
};

export const simpleSelectMocks = createSimpleSelectMockComponents();
