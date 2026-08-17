import { createElement } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { PublicLayout } from "@/layouts/PublicLayout";

import Landing from "@/routes/public/index";
import AboutUs from "@/routes/public/about-us";
import ApiPage from "@/routes/public/api";
import Blog from "@/routes/public/blog";
import ContactUs from "@/routes/public/contact-us";
import Countries from "@/routes/public/countries";
import CountryDetails from "@/routes/public/countries.$countryCode";
import Faq from "@/routes/public/faq";
import Pricing from "@/routes/public/pricing";
import PrivacyPolicy from "@/routes/public/privacy-policy";
import RefundPolicy from "@/routes/public/refund-policy";
import Services from "@/routes/public/services";
import ServiceDetails from "@/routes/public/services.$serviceId";
import TenOTPLanding from "@/routes/public/tenotp";
import TermsAndConditions from "@/routes/public/terms-and-conditions";

/**
 * Public marketing/catalog routes — ports the monolith's `_public.*.tsx`
 * files. See `frontend/src/router.tsx`'s big comment block for the
 * code-based routing convention this follows.
 *
 * This file is intentionally NOT imported by router.tsx yet — another agent
 * merges `publicLayoutRoute` + `publicChildRoutes` into the root route tree
 * (see this task's final report for the exact one-line addition).
 */

/** Pathless layout — every public marketing page nests under this. `PublicLayout`
 * already renders its own <Outlet /> internally (see layouts/PublicLayout.tsx),
 * so this route's component is just PublicLayout itself. No auth guard (public pages). */
export const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public-layout",
  component: () => createElement(PublicLayout),
});

const indexRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/", component: Landing });
const aboutUsRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/about-us", component: AboutUs });
const apiRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/api", component: ApiPage });
const blogRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/blog", component: Blog });
const contactUsRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/contact-us", component: ContactUs });

const countriesSearchDefaults = { q: "", sort: "name", view: "grid", page: 1 };
const countriesRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/countries",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : countriesSearchDefaults.q,
    sort: typeof search.sort === "string" ? search.sort : countriesSearchDefaults.sort,
    view: typeof search.view === "string" ? search.view : countriesSearchDefaults.view,
    page: Number(search.page) > 0 ? Number(search.page) : countriesSearchDefaults.page,
  }),
  component: Countries,
});
const countryDetailRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/countries/$countryCode",
  component: CountryDetails,
});

const faqRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/faq", component: Faq });
const pricingRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/pricing", component: Pricing });
const privacyPolicyRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/privacy-policy", component: PrivacyPolicy });
const refundPolicyRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/refund-policy", component: RefundPolicy });

const servicesSearchDefaults = { q: "", category: "any", country: "", service: "", operator: "", mode: "otp", sort: "popular" };
const servicesRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/services",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : servicesSearchDefaults.q,
    category: typeof search.category === "string" ? search.category : servicesSearchDefaults.category,
    country: typeof search.country === "string" ? search.country : servicesSearchDefaults.country,
    service: typeof search.service === "string" ? search.service : servicesSearchDefaults.service,
    operator: typeof search.operator === "string" ? search.operator : servicesSearchDefaults.operator,
    mode: typeof search.mode === "string" ? search.mode : servicesSearchDefaults.mode,
    sort: typeof search.sort === "string" ? search.sort : servicesSearchDefaults.sort,
  }),
  component: Services,
});
const serviceDetailRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/services/$serviceId",
  component: ServiceDetails,
});

const tenotpRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/tenotp", component: TenOTPLanding });
const termsAndConditionsRoute = createRoute({ getParentRoute: () => publicLayoutRoute, path: "/terms-and-conditions", component: TermsAndConditions });

export const publicChildRoutes = [
  indexRoute,
  aboutUsRoute,
  apiRoute,
  blogRoute,
  contactUsRoute,
  countriesRoute,
  countryDetailRoute,
  faqRoute,
  pricingRoute,
  privacyPolicyRoute,
  refundPolicyRoute,
  servicesRoute,
  serviceDetailRoute,
  tenotpRoute,
  termsAndConditionsRoute,
];
