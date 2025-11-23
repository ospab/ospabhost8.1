export const StructuredData = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ospab.host",
    "url": "https://ospab.host",
    "logo": "https://ospab.host/logo.jpg",
    "description": "Облачный хостинг и виртуальные машины с высокопроизводительной инфраструктурой",
    "sameAs": [
      "https://github.com/ospab"
    ],
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Великий Новгород",
      "addressCountry": "RU"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Support",
      "areaServed": "RU"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};