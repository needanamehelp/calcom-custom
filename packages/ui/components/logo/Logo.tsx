import classNames from "@calcom/ui/classNames";

export function Logo({
  small,
  icon,
  inline = true,
  className,
  src = "/api/logo",
}: {
  small?: boolean;
  icon?: boolean;
  inline?: boolean;
  className?: string;
  src?: string;
}) {
  return (
    <h3 className={classNames("logo", inline && "inline", className)}>
      <strong>
        {icon ? (
          <img className="mx-auto w-9 dark:invert" alt="Cal" title="Cal" src={`${src}?type=icon`} />
        ) : (
          <img
            className={classNames(small ? "h-10 w-auto" : "h-10 w-auto", "dark:invert")}
            alt="Cal"
            title="Cal"
            src={src}
          />
        )}
      </strong>
    </h3>
  );
}
