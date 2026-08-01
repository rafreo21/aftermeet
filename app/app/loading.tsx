import { BrandMark } from "../components/BrandMark";

export default function ConsumerLoading() {
  return (
    <main className="consumer-route-loading" aria-label="Loading AfterMeet" aria-busy="true">
      <aside>
        <div className="consumer-loading-brand"><BrandMark size={34} /><strong>AfterMeet</strong></div>
        <div className="consumer-loading-nav" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      </aside>
      <section>
        <div className="consumer-loading-heading skeleton" />
        <div className="consumer-loading-copy skeleton" />
        <div className="consumer-loading-panel">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </section>
    </main>
  );
}
