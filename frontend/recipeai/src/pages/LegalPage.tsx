import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/languageContext";

const policyUpdatedAt = "May 30, 2026";
const contactEmail = "support@dishgenie.app";
const contactEmailClassName = "font-semibold text-text hover:text-accent";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="border-t border-primary/10 pt-6">
    <h2 className="text-xl font-bold text-text">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-6 text-text/70">
      {children}
    </div>
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-2 pl-5">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const ContactEmailLink = () => (
  <a className={contactEmailClassName} href={`mailto:${contactEmail}`}>
    {contactEmail}
  </a>
);

const EnglishPrivacyPolicyPage = () => (
  <article className="mx-auto max-w-3xl px-5 py-12 md:px-8">
    <p className="text-sm font-semibold text-text/55">
      Last updated {policyUpdatedAt}
    </p>
    <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
      Privacy Policy
    </h1>
    <p className="mt-4 text-base leading-7 text-text/70">
      Dish Genie uses account, recipe, fridge, shopping list, and analytics data
      to run the app, improve the product, and keep the service reliable. This
      policy explains what we collect, why we collect it, who may process it,
      and the choices you have.
    </p>

    <div className="mt-10 space-y-8">
      <Section title="Who We Are">
        <p>
          Dish Genie is a recipe planning and cooking assistant. For privacy questions or data
          requests, contact us at <ContactEmailLink />.
        </p>
      </Section>

      <Section title="Information We Collect">
        <p>
          We collect information you provide directly and information generated
          when you use the app.
        </p>
        <BulletList
          items={[
            "Account information, such as login identifiers and authentication data.",
            "Recipe prompts, generated recipe results, saved recipes, and public recipe activity.",
            "Recipes you save or publish may be visible to other users or visitors depending on app functionality, including the public latest-recipes browsing experience.",
            "Fridge items, ingredient names, shopping list items, and related cooking preferences.",
            "Analytics events, consent choices, device type, browser type, pages viewed, and approximate technical usage data.",
            "Security, error, and diagnostic logs used to protect and maintain the service.",
          ]}
        />
      </Section>

      <Section title="How We Use Information">
        <BulletList
          items={[
            "To create and secure user accounts.",
            "To generate recipe ideas from prompts, ingredients, preferences, and saved context.",
            "To save recipes, fridge items, shopping lists, and profile settings.",
            "To provide analytics, measure product usage, and improve features when analytics is enabled.",
            "To detect abuse, troubleshoot bugs, maintain security, and keep the service reliable.",
            "To respond to support, privacy, deletion, or account requests.",
            "Administrators may access account information and saved recipe content when needed to provide support, moderate abuse, investigate security issues, maintain the service, or comply with legal obligations.",
          ]}
        />
      </Section>

      <Section title="Legal Bases For Processing">
        <p>
          Depending on the feature, we process personal information to provide
          the service you request, to pursue legitimate interests such as
          security and product improvement, to comply with legal obligations,
          and, where required, based on your consent. Analytics consent remains
          separate from accepting these terms and can be changed from the app
          footer when analytics controls are available.
        </p>
      </Section>

      <Section title="AI Processing">
        <p>
          Dish Genie sends recipe prompts, ingredient context, and related
          cooking instructions to AI services, including Google Gemini or other
          model providers we may use to operate recipe generation. Do not enter
          sensitive personal information, medical information, or private data
          that is not needed for recipe suggestions.
        </p>
      </Section>

      <Section title="Analytics And Cookies">
        <p>
          Dish Genie may use cookies, local storage, or similar technologies for
          login, consent preferences, security, and analytics. Analytics is
          optional where the app shows analytics controls. You can change your
          analytics preference from the footer privacy settings button when
          analytics controls are available.
        </p>
      </Section>

      <Section title="Terms And Privacy Acknowledgement">
        <p>
          When you create an account, we record that you accepted the Terms of
          Service and acknowledged this Privacy Policy, along with the policy
          versions in effect at that time. This record helps us demonstrate what
          information was shown when the account was created.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <p>
          We use third-party providers only as needed to operate the app. These
          providers may process information on our behalf.
        </p>
        <BulletList
          items={[
            "AI model providers for recipe generation, such as Google Gemini.",
            "Hosting, database, and infrastructure providers for running the application and storing user data.",
            "Authentication providers or identity services for login and account security.",
            "Analytics providers, such as PostHog, when analytics is available and enabled.",
            "Operational tools used for logs, errors, security, or customer support.",
          ]}
        />
      </Section>

      <Section title="When We Share Information">
        <p>
          We do not sell your personal information. We may share information
          with service providers that help run Dish Genie, when required by law,
          to protect the rights and security of users or the service, or as part
          of a business transfer such as a merger, acquisition, or sale of
          assets.
        </p>
      </Section>

      <Section title="Data Retention">
        <p>
          We keep account data, saved recipes, fridge items, shopping lists, and
          preferences while your account is active or as needed to provide the
          service. We may keep logs and diagnostic records for a limited period
          for security, debugging, abuse prevention, legal, and operational
          reasons. If you request deletion, we will delete or anonymize data
          unless we need to keep it for legitimate legal, security, or business
          reasons.
        </p>
      </Section>

      <Section title="International Processing">
        <p>
          Some service providers may process information in countries other than
          your own. Where required, we rely on appropriate safeguards or provider
          commitments for those transfers.
        </p>
      </Section>

      <Section title="Your Choices">
        <BulletList
          items={[
            "You can choose what prompts, recipes, fridge items, shopping list items, and preferences to save.",
            "You can change analytics consent where the app provides analytics controls.",
            "You can request access, correction, export, deletion, or help with your account by contacting us.",
            "You can stop using the service at any time.",
          ]}
        />
      </Section>

      <Section title="Children">
        <p>
          Dish Genie is not intended for children under 13. We do not knowingly
          collect personal information from children under 13. If you believe a
          child has provided personal information, contact us so we can review
          and delete it where appropriate.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use reasonable technical and organizational measures to protect the
          service and user data. No internet service can guarantee perfect
          security, so you should use a strong password, protect your login
          method, and avoid adding sensitive information that is not needed for
          recipes.
        </p>
      </Section>

      <Section title="Policy Updates">
        <p>
          We may update this Privacy Policy as Dish Genie changes. The updated
          date at the top of this page shows when the policy was last revised.
          Continued use of the app after an update means the new policy applies.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions or data requests, email{" "}
          <ContactEmailLink />
          .
        </p>
      </Section>
    </div>

    <Link
      to="/terms"
      className="mt-10 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
    >
      View Terms of Service
    </Link>
  </article>
);

const EnglishTermsOfServicePage = () => (
  <article className="mx-auto max-w-3xl px-5 py-12 md:px-8">
    <p className="text-sm font-semibold text-text/55">
      Last updated {policyUpdatedAt}
    </p>
    <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
      Terms of Service
    </h1>
    <p className="mt-4 text-base leading-7 text-text/70">
      These terms describe the basic rules for using Dish Genie. By using the
      app, you agree to use it responsibly and understand that recipe and AI
      outputs require your own judgment.
    </p>

    <div className="mt-10 space-y-8">
      <Section title="Using Dish Genie">
        <p>
          Dish Genie helps users generate, browse, save, and organize recipe
          ideas. You are responsible for your account activity and for keeping
          your login details secure.
        </p>
        <p>
          Creating an account requires accepting these Terms of Service and
          acknowledging the Privacy Policy in effect at that time.
        </p>
      </Section>

      <Section title="Eligibility And Accounts">
        <p>
          You must be able to enter into these terms to use Dish Genie. You are
          responsible for the accuracy of information you provide, for activity
          under your account, and for keeping your account access secure. Notify
          us if you believe your account has been used without permission.
        </p>
      </Section>

      <Section title="Recipe And AI Output">
        <p>
          AI-generated recipes may be incomplete, inaccurate, or unsuitable for
          specific diets, allergies, equipment, or health needs. Check
          ingredients, cooking temperatures, allergens, and food safety details
          before preparing or eating a recipe.
        </p>
        <p>
          Dish Genie does not provide medical, nutrition, allergy, or food
          safety advice. You are responsible for deciding whether a recipe is
          appropriate for you and anyone you cook for.
        </p>
      </Section>

      <Section title="Acceptable Use">
        <BulletList
          items={[
            "Do not misuse, disrupt, overload, scrape, or attempt to damage the service.",
            "Do not attempt to access accounts, systems, data, or features you are not authorized to access.",
            "Do not upload unlawful, harmful, abusive, infringing, deceptive, or malicious content.",
            "Do not reverse engineer restricted parts of the service or bypass security controls.",
            "Do not use Dish Genie to create unsafe instructions or content that could harm people.",
          ]}
        />
      </Section>

      <Section title="Your Content">
        <p>
          You keep ownership of prompts, recipes, fridge items, shopping list
          items, preferences, and other content you add to Dish Genie. You grant
          us a limited permission to host, store, display, process, transmit,
          and use that content as needed to provide, secure, support, and
          improve the service.
        </p>
        <p>
          You are responsible for making sure your content is lawful and that
          you have the rights needed to add it to the app.
        </p>
      </Section>

      <Section title="Public Recipes">
        <p>
          If the app allows you to publish or share recipes publicly, other
          users may view and use that content. Do not publish private,
          sensitive, unlawful, or third-party content unless you have permission
          to share it.
        </p>
      </Section>

      <Section title="Payments And Paid Features">
        <p>
          If paid features are added later, pricing, billing, cancellation, and
          refund terms will be shown before purchase or in the relevant plan
          details. Until then, no paid-plan terms apply.
        </p>
      </Section>

      <Section title="Service Changes">
        <p>
          We may update, suspend, or remove features as the product evolves. We
          may also update these terms when the service changes. We may suspend
          or terminate access if an account violates these terms, creates risk,
          or is used in a way that could harm Dish Genie, users, or third
          parties.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          Dish Genie is provided as is and as available. We do not guarantee
          that the service will be uninterrupted, error-free, secure, or that
          any recipe output will be accurate, complete, safe, or suitable for
          your needs.
        </p>
      </Section>

      <Section title="Limitation Of Liability">
        <p>
          To the fullest extent allowed by law, Dish Genie and its operators
          will not be liable for indirect, incidental, special, consequential,
          exemplary, or punitive damages, or for lost profits, lost data, food
          preparation issues, allergic reactions, health outcomes, or reliance
          on recipe output.
        </p>
      </Section>

      <Section title="Changes To These Terms">
        <p>
          We may update these Terms of Service from time to time. The updated
          date at the top of this page shows when the terms were last revised.
          Continued use of the app after an update means the new terms apply.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For service questions, email <ContactEmailLink />.
        </p>
      </Section>
    </div>

    <Link
      to="/privacy"
      className="mt-10 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
    >
      View Privacy Policy
    </Link>
  </article>
);

const PolishPrivacyPolicyPage = () => (
  <article className="mx-auto max-w-3xl px-5 py-12 md:px-8" lang="pl">
    <p className="text-sm font-semibold text-text/55">
      Ostatnia aktualizacja: 30 maja 2026 r.
    </p>
    <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
      Polityka prywatności
    </h1>
    <p className="mt-4 text-base leading-7 text-text/70">
      Dish Genie przetwarza dane konta, przepisów, lodówki, list zakupów i
      analityki, aby świadczyć usługę, rozwijać produkt i dbać o jego
      niezawodność. Poniżej wyjaśniamy, jakie dane zbieramy i jakie masz prawa.
    </p>

    <div className="mt-10 space-y-8">
      <Section title="Administrator i kontakt">
        <p>
          Administratorem danych związanych z usługą Dish Genie jest operator
          aplikacji. W sprawach prywatności i żądań dotyczących danych napisz
          na adres <ContactEmailLink />.
        </p>
      </Section>
      <Section title="Jakie informacje zbieramy">
        <BulletList
          items={[
            "Dane konta, identyfikatory logowania oraz dane uwierzytelniające.",
            "Zapytania do generatora, wygenerowane i zapisane przepisy oraz aktywność dotyczącą przepisów publicznych.",
            "Produkty w lodówce, listy zakupów i preferencje żywieniowe.",
            "Za zgodą: zdarzenia analityczne, typ urządzenia i przeglądarki oraz odwiedzane podstrony.",
            "Logi bezpieczeństwa, błędów i diagnostyki potrzebne do ochrony usługi.",
          ]}
        />
      </Section>
      <Section title="Cele i podstawy przetwarzania">
        <p>
          Dane wykorzystujemy do utworzenia i zabezpieczenia konta,
          generowania przepisów, zapisywania ustawień i treści, obsługi
          użytkownika, zapobiegania nadużyciom oraz poprawy produktu. Podstawą
          jest wykonanie umowy, uzasadniony interes związany z bezpieczeństwem
          i rozwojem usługi, obowiązek prawny albo — w przypadku opcjonalnej
          analityki — Twoja zgoda.
        </p>
      </Section>
      <Section title="Przetwarzanie przez AI">
        <p>
          Zapytania o przepisy, składniki i instrukcje kulinarne mogą być
          przesyłane do dostawców modeli AI, w tym Google Gemini. Nie wpisuj
          danych wrażliwych, medycznych ani prywatnych informacji, które nie są
          potrzebne do uzyskania propozycji przepisu.
        </p>
      </Section>
      <Section title="Pliki cookies, pamięć lokalna i analityka">
        <p>
          Używamy cookies, pamięci lokalnej lub podobnych technologii do
          logowania, zapamiętania języka i zgód, ochrony usługi oraz — po
          wyrażeniu zgody — analityki. Ustawienia analityki możesz zmienić z
          poziomu stopki aplikacji.
        </p>
      </Section>
      <Section title="Odbiorcy i przekazywanie danych">
        <p>
          Nie sprzedajemy danych osobowych. Dane mogą przetwarzać w naszym
          imieniu dostawcy modeli AI, hostingu, baz danych, uwierzytelniania,
          analityki, logów i obsługi technicznej. Niektórzy dostawcy mogą
          przetwarzać dane poza Twoim krajem; tam, gdzie jest to wymagane,
          stosujemy odpowiednie zabezpieczenia transferu.
        </p>
      </Section>
      <Section title="Publiczne treści i dostęp administracyjny">
        <p>
          Przepisy zapisane lub opublikowane jako publiczne mogą być widoczne
          dla innych osób. Administratorzy mogą uzyskać dostęp do danych konta
          i zapisanych treści tylko w zakresie potrzebnym do wsparcia,
          moderacji, bezpieczeństwa, utrzymania usługi lub realizacji obowiązków
          prawnych.
        </p>
      </Section>
      <Section title="Okres przechowywania i bezpieczeństwo">
        <p>
          Dane konta i zapisane treści przechowujemy, dopóki konto jest aktywne
          lub jest to potrzebne do świadczenia usługi. Logi mogą być zachowane
          przez ograniczony czas ze względów bezpieczeństwa i prawnych.
          Stosujemy rozsądne środki techniczne i organizacyjne, ale żadna usługa
          internetowa nie gwarantuje pełnego bezpieczeństwa.
        </p>
      </Section>
      <Section title="Twoje prawa">
        <BulletList
          items={[
            "Możesz poprosić o dostęp, sprostowanie, kopię, ograniczenie przetwarzania lub usunięcie danych.",
            "Możesz wycofać zgodę na analitykę bez wpływu na wcześniejsze przetwarzanie.",
            "Możesz wnieść sprzeciw lub skargę do właściwego organu ochrony danych.",
            "Możesz przestać korzystać z usługi w dowolnym momencie.",
          ]}
        />
      </Section>
      <Section title="Dzieci i zmiany polityki">
        <p>
          Dish Genie nie jest przeznaczone dla dzieci poniżej 13 lat. Polityka
          może się zmieniać wraz z rozwojem usługi; data u góry wskazuje jej
          aktualną wersję.
        </p>
      </Section>
    </div>
    <Link
      to="/terms"
      className="mt-10 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
    >
      Zobacz regulamin
    </Link>
  </article>
);

const PolishTermsOfServicePage = () => (
  <article className="mx-auto max-w-3xl px-5 py-12 md:px-8" lang="pl">
    <p className="text-sm font-semibold text-text/55">
      Ostatnia aktualizacja: 30 maja 2026 r.
    </p>
    <h1 className="mt-3 text-3xl font-bold text-text md:text-4xl">
      Regulamin świadczenia usług
    </h1>
    <p className="mt-4 text-base leading-7 text-text/70">
      Regulamin opisuje zasady korzystania z Dish Genie. Używając aplikacji,
      zgadzasz się korzystać z niej odpowiedzialnie i samodzielnie oceniać
      przepisy oraz treści wygenerowane przez AI.
    </p>
    <div className="mt-10 space-y-8">
      <Section title="Korzystanie z Dish Genie">
        <p>
          Dish Genie pomaga generować, przeglądać, zapisywać i organizować
          pomysły na przepisy. Odpowiadasz za aktywność na swoim koncie,
          prawdziwość podanych informacji i ochronę danych logowania. Utworzenie
          konta wymaga zaakceptowania regulaminu i potwierdzenia zapoznania się
          z Polityką prywatności.
        </p>
      </Section>
      <Section title="Przepisy i treści AI">
        <p>
          Wygenerowane przepisy mogą być niepełne, niedokładne lub
          nieodpowiednie dla określonej diety, alergii, sprzętu albo stanu
          zdrowia. Przed gotowaniem sprawdź składniki, alergeny, temperatury i
          zasady bezpieczeństwa żywności. Dish Genie nie udziela porad
          medycznych, dietetycznych ani dotyczących alergii.
        </p>
      </Section>
      <Section title="Dozwolone korzystanie">
        <BulletList
          items={[
            "Nie zakłócaj, nie przeciążaj, nie skanuj automatycznie i nie próbuj uszkodzić usługi.",
            "Nie próbuj uzyskać dostępu do cudzych kont, danych lub niedostępnych funkcji.",
            "Nie dodawaj treści bezprawnych, szkodliwych, obraźliwych, naruszających prawa lub zawierających złośliwy kod.",
            "Nie obchodź zabezpieczeń ani ograniczeń usługi.",
            "Nie używaj aplikacji do tworzenia niebezpiecznych instrukcji.",
          ]}
        />
      </Section>
      <Section title="Twoje treści i przepisy publiczne">
        <p>
          Zachowujesz prawa do dodawanych treści. Udzielasz nam ograniczonej
          zgody na ich przechowywanie, wyświetlanie, przesyłanie i przetwarzanie
          w zakresie potrzebnym do działania, ochrony i rozwoju usługi. Jeśli
          opublikujesz przepis, inni użytkownicy mogą go zobaczyć i wykorzystać.
          Odpowiadasz za legalność treści i prawo do ich udostępnienia.
        </p>
      </Section>
      <Section title="Zmiany i zakończenie usługi">
        <p>
          Możemy rozwijać, zawieszać lub usuwać funkcje. Dostęp może zostać
          ograniczony lub zakończony, jeśli konto narusza regulamin, stwarza
          ryzyko albo szkodzi użytkownikom, usłudze lub osobom trzecim. Warunki
          ewentualnych płatnych funkcji zostaną przedstawione przed zakupem.
        </p>
      </Section>
      <Section title="Wyłączenia odpowiedzialności">
        <p>
          Usługa jest dostarczana w aktualnie dostępnej postaci. Nie
          gwarantujemy nieprzerwanego działania ani kompletności, poprawności i
          przydatności wygenerowanych przepisów. W najszerszym zakresie
          dozwolonym prawem nie odpowiadamy za szkody pośrednie, utratę danych,
          skutki przygotowania żywności, reakcje alergiczne ani decyzje podjęte
          wyłącznie na podstawie treści AI. Ograniczenia te nie wyłączają praw,
          których nie można wyłączyć na mocy obowiązującego prawa konsumenckiego.
        </p>
      </Section>
      <Section title="Zmiany regulaminu i kontakt">
        <p>
          Regulamin może być aktualizowany wraz ze zmianami usługi. Data u góry
          wskazuje bieżącą wersję. W sprawach dotyczących usługi napisz na adres{" "}
          <ContactEmailLink />.
        </p>
      </Section>
    </div>
    <Link
      to="/privacy"
      className="mt-10 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
    >
      Zobacz politykę prywatności
    </Link>
  </article>
);

export const PrivacyPolicyPage = () => {
  const { locale } = useLanguage();
  return locale === "pl" ? (
    <PolishPrivacyPolicyPage />
  ) : (
    <EnglishPrivacyPolicyPage />
  );
};

export const TermsOfServicePage = () => {
  const { locale } = useLanguage();
  return locale === "pl" ? (
    <PolishTermsOfServicePage />
  ) : (
    <EnglishTermsOfServicePage />
  );
};
