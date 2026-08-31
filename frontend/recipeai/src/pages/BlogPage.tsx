import { Link, useParams } from "react-router-dom";
import { getBlogPost, getBlogPosts } from "../lib/blogPosts";
import { useLanguage } from "../context/languageContext";

export const BlogIndexPage = () => {
  const { locale, t } = useLanguage();
  const blogPosts = getBlogPosts(locale);

  return (
  <section className="mx-auto max-w-5xl px-5 py-12 md:px-8">
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text/50">
        Dish Genie Blog
      </p>
      <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
        {t("Practical cooking ideas for busy kitchens")}
      </h1>
      <p className="mt-4 text-base leading-7 text-text/70">
        {t("Short guides on recipe generation, fridge organization, meal planning, and turning the food you already have into realistic meals.")}
      </p>
    </div>

    <div className="mt-10 grid gap-5 md:grid-cols-3">
      {blogPosts.map((post) => (
        <article
          key={post.slug}
          className="flex h-full flex-col rounded-lg border border-primary/10 bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/45">
            {post.category}
          </p>
          <h2 className="mt-3 text-xl font-bold leading-tight text-text">
            <Link to={`/blog/${post.slug}`} className="hover:text-accent">
              {post.title}
            </Link>
          </h2>
          <p className="mt-3 flex-1 text-sm leading-6 text-text/65">
            {post.description}
          </p>
          <div className="mt-5 flex items-center justify-between text-xs font-medium text-text/50">
            <time dateTime={post.publishedAt}>
              {new Date(`${post.publishedAt}T00:00:00`).toLocaleDateString(
                locale === "pl" ? "pl-PL" : "en",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                },
              )}
            </time>
            <span>{post.readingTime}</span>
          </div>
        </article>
      ))}
    </div>
  </section>
  );
};

export const BlogPostPage = () => {
  const { slug } = useParams();
  const { locale, t } = useLanguage();
  const post = getBlogPost(slug, locale);

  if (!post) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16 text-center md:px-8">
        <h1 className="text-3xl font-bold text-text">{t("Blog post not found")}</h1>
        <p className="mt-3 text-sm leading-6 text-text/65">
          {t("The article you opened does not exist or has moved.")}
        </p>
        <Link
          to="/blog"
          className="mt-6 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
        >
          {t("Back to blog")}
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <Link
        to="/blog"
        className="text-sm font-semibold text-text/55 hover:text-accent"
      >
        {t("Back to blog")}
      </Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-text/50">
        {post.category}
      </p>
      <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
        {post.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text/50">
        <time dateTime={post.publishedAt}>
          {new Date(`${post.publishedAt}T00:00:00`).toLocaleDateString(locale === "pl" ? "pl-PL" : "en", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <span>{post.readingTime}</span>
      </div>
      <p className="mt-6 text-lg leading-8 text-text/75">{post.intro}</p>

      <div className="mt-10 space-y-8">
        {post.sections.map((section) => (
          <section
            key={section.heading}
            className="border-t border-primary/10 pt-6"
          >
            <h2 className="text-xl font-bold text-text">{section.heading}</h2>
            <p className="mt-3 text-base leading-7 text-text/70">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-10 border-t border-primary/10 pt-6">
        <h2 className="text-xl font-bold text-text">
          {t("Turn your ingredients into dinner")}
        </h2>
        <p className="mt-3 text-base leading-7 text-text/70">
          {t("Dish Genie can turn a craving, a few fridge items, or a no-shopping constraint into three realistic recipe ideas.")}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
          >
            {t("Get recipe ideas")}
          </Link>
          <Link
            to="/Recipes"
            className="inline-flex rounded-full border border-primary/15 px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent"
          >
            {t("Browse recipes")}
          </Link>
        </div>
      </section>
    </article>
  );
};
