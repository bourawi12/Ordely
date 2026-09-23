import Link from "next/link";
import Logo from "@/components/Logo";
import Counter from "@/components/landing/Counter";
import HeroSceneLoader from "@/components/landing/HeroSceneLoader";
import Icon, { type IconName } from "@/components/Icon";
import PhoneMockup from "@/components/landing/PhoneMockup";
import Reveal from "@/components/landing/Reveal";
import styles from "@/components/landing/landing.module.css";

const CONTACT_EMAIL = "hello@ordely.tn";

const pillars: { icon: IconName; title: string; tagline: string; text: string }[] = [
  {
    icon: "phone",
    title: "Appels IA",
    tagline: "Automatisés et intelligents",
    text: "Une voix naturelle appelle chaque client dès que la commande arrive, sans mobiliser votre équipe.",
  },
  {
    icon: "check",
    title: "Confirmation de commandes",
    tagline: "Rapide et fiable",
    text: "Produit, quantité, adresse : tout est vérifié de vive voix, puis mis à jour automatiquement.",
  },
  {
    icon: "trending",
    title: "Plus de ventes",
    tagline: "Avec moins d'effort",
    text: "Moins de retours et de colis refusés, plus de commandes livrées et encaissées.",
  },
];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "cart", title: "E-commerce", text: "Connecté à votre boutique, les commandes arrivent toutes seules." },
  { icon: "cloud", title: "Cloud", text: "Rien à installer. Ordely tourne en ligne, où que vous soyez." },
  { icon: "shield", title: "Sécurité", text: "Les données de vos clients restent protégées et confidentielles." },
  { icon: "chart", title: "Analytics", text: "Suivez vos taux de confirmation et vos appels en temps réel." },
  { icon: "sliders", title: "Paramètres", text: "Adaptez le script, les horaires et les relances à votre activité." },
  { icon: "headset", title: "Support", text: "Une équipe à votre écoute pour vous accompagner au quotidien." },
];

const steps = [
  { title: "Une commande arrive", text: "Ordely la récupère instantanément depuis votre boutique en ligne." },
  { title: "L'IA appelle votre client", text: "Un appel naturel pour confirmer le produit, la quantité et l'adresse." },
  { title: "Commande confirmée", text: "Le statut est mis à jour : vous expédiez l'esprit tranquille." },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <Logo />
          </Link>
          <nav className={styles.navLinks}>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#comment">Comment ça marche</a>
            <a href="#contact">Contact</a>
          </nav>
          <Link href="/login" className={`${styles.btn} ${styles.btnSmall}`}>
            Se connecter
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.blobA} aria-hidden="true" />
          <div className={styles.blobB} aria-hidden="true" />
          <HeroSceneLoader className={styles.scene} />

          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={`${styles.eyebrow} ${styles.enter}`}>
                <span className={styles.liveDot} />
                Confirmation de commandes par IA
              </p>
              <h1 className={`${styles.heroTitle} ${styles.enter}`} style={{ animationDelay: "80ms" }}>
                L&apos;IA qui confirme{" "}
                <span className={styles.highlight}>
                  vos commandes.
                  <svg viewBox="0 0 280 22" aria-hidden="true">
                    <path d="M8 5 Q140 30 272 5" pathLength={1} />
                  </svg>
                </span>
              </h1>
              <p className={`${styles.heroText} ${styles.enter}`} style={{ animationDelay: "160ms" }}>
                Ordely appelle automatiquement chacun de vos clients, vérifie la commande et
                l&apos;adresse, puis met à jour votre boutique. Moins de retours, plus de ventes.
              </p>
              <div className={`${styles.heroCtas} ${styles.enter}`} style={{ animationDelay: "240ms" }}>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Demande%20de%20d%C3%A9mo%20Ordely`} className={styles.btn}>
                  Demander une démo
                  <Icon name="arrow" size={18} />
                </a>
                <Link href="/orders" className={`${styles.btn} ${styles.btnGhost}`}>
                  Voir l&apos;application
                </Link>
              </div>
            </div>

            <div className={`${styles.heroVisual} ${styles.enterVisual}`}>
              <PhoneMockup />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className={styles.stats}>
          <Reveal className={styles.statsInner}>
            <div className={styles.stat}>
              <strong>
                <Counter to={98.7} decimals={1} suffix="%" />
              </strong>
              <span>Taux de réussite des appels</span>
            </div>
            <div className={styles.stat}>
              <strong>
                <Counter to={2} suffix=" min" duration={900} />
              </strong>
              <span>Temps moyen d&apos;appel</span>
            </div>
            <div className={styles.stat}>
              <strong>
                <Counter to={348} />
              </strong>
              <span>Commandes confirmées aujourd&apos;hui</span>
            </div>
          </Reveal>
        </section>

        {/* Pillars */}
        <section id="fonctionnalites" className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>Pourquoi Ordely</p>
            <h2>Vos commandes. Confirmées.</h2>
            <p>Fini les appels manuels et les colis refusés. Ordely s&apos;occupe de tout, de l&apos;appel à la mise à jour.</p>
          </Reveal>

          <div className={styles.pillars}>
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 120} className={styles.pillar}>
                <span className={styles.pillarIcon}>
                  <Icon name={pillar.icon} size={28} />
                </span>
                <h3>{pillar.title}</h3>
                <p className={styles.pillarTag}>{pillar.tagline}</p>
                <p>{pillar.text}</p>
              </Reveal>
            ))}
          </div>

          <div className={styles.features}>
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 90} className={styles.feature}>
                <Icon name={feature.icon} size={26} className={styles.featureIcon} />
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="comment" className={`${styles.section} ${styles.howSection}`}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.kicker}>Comment ça marche</p>
            <h2>Trois étapes, zéro effort</h2>
          </Reveal>

          <Reveal className={styles.steps}>
            <div className={styles.stepsLine} aria-hidden="true" />
            {steps.map((step, i) => (
              <div key={step.title} className={styles.step} style={{ ["--i" as string]: i }}>
                <span className={styles.stepNum}>{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* CTA */}
        <section className={styles.ctaWrap}>
          <Reveal className={styles.cta}>
            <svg className={styles.ctaSmile} viewBox="0 0 100 32" aria-hidden="true">
              <path d="M6 6 Q50 44 94 6" />
            </svg>
            <h2>Prêt à confirmer plus de commandes ?</h2>
            <p>Parlez à notre équipe et lancez Ordely sur votre boutique en quelques jours.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={`${styles.btn} ${styles.btnWhite}`}>
              Parler à l&apos;équipe
              <Icon name="arrow" size={18} />
            </a>
          </Reveal>
        </section>
      </main>

      <footer id="contact" className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <Logo className={styles.footerLogo} />
            <p>Vos commandes. Confirmées.</p>
          </div>
          <ul className={styles.contactList}>
            <li>
              <Icon name="globe" size={18} />
              <a href="https://www.ordely.tn">www.ordely.tn</a>
            </li>
            <li>
              <Icon name="mail" size={18} />
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              <Icon name="pin" size={18} />
              Tunis, Tunisie
            </li>
          </ul>
        </div>
        <p className={styles.copyright}>© {new Date().getFullYear()} Ordely. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
