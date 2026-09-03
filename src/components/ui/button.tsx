"use client";

import { Button as WdsButton } from "@wanteddev/wds";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "small" | "medium" | "large";

type ButtonOwnProps = {
  /** "primary" renders a solid Wanted-blue button. "secondary" renders an outlined button. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
};

type ButtonProps<E extends ElementType = "button"> = ButtonOwnProps & {
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, keyof ButtonOwnProps | "as" | "color">;

/**
 * Thin wrapper around WDS's `Button` that maps this project's simpler
 * primary/secondary vocabulary onto WDS's variant/color props, and keeps
 * WDS's own polymorphic `as` support (e.g. `as={Link}` for a link styled
 * as a button).
 */
export function Button<E extends ElementType = "button">({ variant = "primary", size = "large", as, ...rest }: ButtonProps<E>) {
  const Component = WdsButton as unknown as ElementType;
  return <Component as={as} color="primary" size={size} variant={variant === "primary" ? "solid" : "outlined"} {...rest} />;
}
