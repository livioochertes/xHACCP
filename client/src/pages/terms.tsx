import { useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { Link } from "wouter";
import { Calendar, Mail, Phone, MapPin, FileText, Shield, Users, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export default function Terms() {
  const { t } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: "introduction",
      icon: FileText,
      title: t('terms.introduction.title'),
      content: [
        t('terms.introduction.ownership'),
        t('terms.introduction.company'),
        t('terms.introduction.platform'),
        t('terms.introduction.acceptance'),
        t('terms.introduction.agreement')
      ]
    },
    {
      id: "purpose",
      icon: Globe,
      title: t('terms.purpose.title'),
      content: [
        t('terms.purpose.description'),
        t('terms.purpose.marketplace'),
        t('terms.purpose.loyalty'),
        t('terms.purpose.payments'),
        t('terms.purpose.information'),
        t('terms.purpose.audience'),
        t('terms.purpose.access')
      ]
    },
    {
      id: "intellectual",
      icon: Shield,
      title: t('terms.intellectual.title'),
      content: [
        t('terms.intellectual.ownership'),
        t('terms.intellectual.rights'),
        t('terms.intellectual.usage'),
        t('terms.intellectual.prohibited'),
        t('terms.intellectual.violations')
      ]
    },
    {
      id: "usage",
      icon: Users,
      title: t('terms.usage.title'),
      content: [
        t('terms.usage.general'),
        t('terms.usage.prohibited'),
        t('terms.usage.violations'),
        t('terms.usage.contact'),
        t('terms.usage.information')
      ]
    },
    {
      id: "liability",
      icon: Shield,
      title: t('terms.liability.title'),
      content: [
        t('terms.liability.efforts'),
        t('terms.liability.disclaimers'),
        t('terms.liability.information'),
        t('terms.liability.limitations'),
        t('terms.liability.thirdparty'),
        t('terms.liability.risk')
      ]
    },
    {
      id: "modifications",
      icon: FileText,
      title: t('terms.modifications.title'),
      content: [
        t('terms.modifications.rights'),
        t('terms.modifications.recommendations'),
        t('terms.modifications.discontinuation')
      ]
    },
    {
      id: "jurisdiction",
      icon: MapPin,
      title: t('terms.jurisdiction.title'),
      content: [
        t('terms.jurisdiction.law'),
        t('terms.jurisdiction.disputes'),
        t('terms.jurisdiction.consumer')
      ]
    },
    {
      id: "privacy",
      icon: Shield,
      title: t('terms.privacy.title'),
      content: [
        t('terms.privacy.importance'),
        t('terms.privacy.consent'),
        t('terms.privacy.contact')
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="kitchen-pro-secondary py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t('terms.hero.title')}
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              {t('terms.hero.subtitle')}
            </p>
            <div className="flex items-center justify-center space-x-4 text-blue-100">
              <Calendar className="h-5 w-5" />
              <span>{t('terms.hero.lastUpdated')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Company Information */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-secondary" />
                  <span>{t('terms.company.title')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-secondary mt-1" />
                      <div>
                        <p className="font-semibold text-primary">NAMARTE</p>
                        <p className="text-slate-600">Calea Moșilor no. 158</p>
                        <p className="text-slate-600">Bucharest, District 2, Romania</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-secondary" />
                      <div>
                        <p className="text-slate-600">{t('terms.company.tax')}: RO16582983</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-secondary" />
                      <div>
                        <p className="text-slate-600">info@xhaccp.com</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-secondary" />
                      <div>
                        <p className="text-slate-600">+40 740 000 520</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="py-16 kitchen-pro-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {sections.map((section, index) => (
              <Card key={section.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-primary">
                        {index + 1}. {section.title}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-slate-700 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Card>
              <CardContent className="pt-6">
                <p className="text-slate-600 mb-4">
                  {t('terms.footer.questions')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/ai-assistant" className="text-secondary hover:text-secondary/80 font-medium">
                    {t('terms.footer.support')}
                  </Link>
                  <span className="hidden sm:inline text-slate-400">|</span>
                  <a href="mailto:dpo@xhaccp.com" className="text-secondary hover:text-secondary/80 font-medium">
                    {t('terms.footer.privacy')}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}