import { ServiceCards } from "@/features/home/ServiceCards";
import { Icon, type IconName } from "@/ui/Icon";
import { SearchPanel } from "@/features/search/SearchPanel";
import { PageTransition } from "@/features/shell/PageTransition";
import styles from "./page.module.css";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "search",
    title: "Search from anywhere",
    text: "Press / on any page to find a series in all three services at once.",
  },
  {
    icon: "chart-line",
    title: "Compare series",
    text: "Plot up to six together, rebased to 100 so different sizes stay readable.",
  },
  {
    icon: "sigma",
    title: "Transform the data",
    text: "Moving average, rolling sum, percent change, cumulative and z-score, chained in any order.",
  },
  {
    icon: "link",
    title: "Share the exact view",
    text: "Series, range and transforms live in the link, so a bookmark brings it all back.",
  },
];

export default function HomePage() {
  return (
    <PageTransition id="home">
      <div className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroInner}>
            <h1 id="home-title" className={styles.title}>
              Search, chart and transform every series
            </h1>
            <p className={styles.lede}>
              Equities, investor flows and composite scores from three data services. Find a series by name, ticker, id,
              sector or region, then compare and transform it.
            </p>
            <SearchPanel variant="hero" />
          </div>
        </section>

        <div className={styles.content}>
          <ServiceCards />

          <section aria-labelledby="features-heading" className={styles.features}>
            <h2 id="features-heading" className={styles.sectionTitle}>
              On every service page
            </h2>
            <ul role="list" className={styles.featureList}>
              {FEATURES.map((feature) => (
                <li key={feature.title} className={styles.feature}>
                  <span className={styles.featureIcon}>
                    <Icon name={feature.icon} size={20} />
                  </span>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureText}>{feature.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className={styles.about}>
            <strong>About the data:</strong> the series are synthetic, from three mock services covering January 2021 to
            December 2025. They show how the tools work, not real markets.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
