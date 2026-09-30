import Icon from "@/components/Icon";
import { PASSWORD_RULES } from "@/lib/password";
import type { Locale } from "@/lib/theme";
import styles from "./password-rules.module.css";

const STATE = {
  en: { met: "done", missing: "missing" },
  fr: { met: "ok", missing: "manquant" },
};

/** Live checklist of the password rule; each line turns green once the password meets it. */
export default function PasswordRules({
  value,
  id,
  locale = "en",
}: {
  value: string;
  /** For the password input's aria-describedby. */
  id?: string;
  locale?: Locale;
}) {
  return (
    <ul id={id} className={styles.rules}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} data-met={met}>
            {met ? (
              <Icon name="check" size={15} className={styles.mark} />
            ) : (
              <span className={`${styles.mark} ${styles.todo}`} aria-hidden="true" />
            )}
            {rule[locale]}
            <span className="sr-only"> ({met ? STATE[locale].met : STATE[locale].missing})</span>
          </li>
        );
      })}
    </ul>
  );
}
