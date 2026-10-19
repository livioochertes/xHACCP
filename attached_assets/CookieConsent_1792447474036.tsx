import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Settings, Shield, Eye, Target, Cookie } from "lucide-react";

import { useLocation } from "wouter";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

const defaultPreferences: CookiePreferences = {
  essential: true, // Always required
  analytics: false,
  functional: false,
  marketing: false,
};

export default function CookieConsent() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      try {
        const savedPreferences = JSON.parse(cookieConsent);
        setPreferences(savedPreferences);
        applyCookieSettings(savedPreferences);
      } catch (error) {
        console.error('Error parsing cookie preferences:', error);
      }
    }
  }, []);

  const applyCookieSettings = (prefs: CookiePreferences) => {
    // Set cookie preferences in localStorage
    localStorage.setItem('cookiePreferences', JSON.stringify(prefs));
    
    // Apply analytics settings
    if (prefs.analytics) {
      // Enable Google Analytics or other analytics
      (window as any).gtag?.('consent', 'update', {
        analytics_storage: 'granted'
      });
    } else {
      (window as any).gtag?.('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
    
    // Apply marketing settings
    if (prefs.marketing) {
      (window as any).gtag?.('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    } else {
      (window as any).gtag?.('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    applyCookieSettings(allAccepted);
    setIsVisible(false);
  };

  const rejectNonEssential = () => {
    const onlyEssential: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    
    localStorage.setItem('cookieConsent', JSON.stringify(onlyEssential));
    applyCookieSettings(onlyEssential);
    setIsVisible(false);
  };

  const saveCustomPreferences = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(preferences));
    applyCookieSettings(preferences);
    setShowSettings(false);
    setIsVisible(false);
  };

  const updatePreference = (type: keyof CookiePreferences, value: boolean) => {
    if (type === 'essential') return; // Essential cookies cannot be disabled
    
    setPreferences(prev => ({
      ...prev,
      [type]: value
    }));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Cookie Consent Banner */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 p-4"
        style={{ zIndex: 2147483646 }}
      >
        <div className="max-w-7xl mx-auto">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        We use cookies to enhance your experience
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        We use essential cookies to make our site work. We'd also like to set optional cookies to help us improve our website. 
                        By clicking "Accept All", you agree to our use of cookies. You can customize your preferences or learn more in our{' '}
                        <a 
                          href="/cookie-policy" 
                          target="_blank"
                          className="text-primary hover:underline font-medium"
                        >
                          Cookie Policy
                        </a>.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Shield className="h-3 w-3 mr-1" />
                          GDPR Compliant
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          <Eye className="h-3 w-3 mr-1" />
                          Transparent
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={acceptAll}
                          className="bg-primary hover:bg-primary/90 text-white px-6"
                        >
                          Accept All
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={rejectNonEssential}
                          className="px-6"
                        >
                          Reject Non-Essential
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => setShowSettings(true)}
                          className="px-6"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Customize
                        </Button>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Dismiss cookie banner"
                      onClick={() => setIsVisible(false)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Manage your cookie preferences. You can enable or disable different types of cookies below. 
              Essential cookies cannot be disabled as they are necessary for the website to function properly.
            </p>
            
            {/* Essential Cookies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-green-600" />
                    <h4 className="font-medium">Essential Cookies</h4>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Always Active
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    These cookies are necessary for the website to function and cannot be switched off. 
                    They enable core functionality like security, network management, and accessibility.
                  </p>
                </div>
                <Switch
                  checked={preferences.essential}
                  disabled={true}
                  className="ml-4"
                />
              </div>
            </div>
            
            {/* Analytics Cookies */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium">Analytics Cookies</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    These cookies help us understand how visitors interact with our website by collecting 
                    and reporting information anonymously to improve our services.
                  </p>
                </div>
                <Switch
                  checked={preferences.analytics}
                  onCheckedChange={(checked) => updatePreference('analytics', checked)}
                  className="ml-4"
                />
              </div>
            </div>
            
            {/* Functional Cookies */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Settings className="h-4 w-4 text-purple-600" />
                    <h4 className="font-medium">Functional Cookies</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    These cookies enable enhanced functionality and personalization, such as remembering 
                    your preferences and providing personalized content.
                  </p>
                </div>
                <Switch
                  checked={preferences.functional}
                  onCheckedChange={(checked) => updatePreference('functional', checked)}
                  className="ml-4"
                />
              </div>
            </div>
            
            {/* Marketing Cookies */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-orange-600" />
                    <h4 className="font-medium">Marketing Cookies</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    These cookies are used to deliver relevant advertisements and track the effectiveness 
                    of advertising campaigns based on your interests.
                  </p>
                </div>
                <Switch
                  checked={preferences.marketing}
                  onCheckedChange={(checked) => updatePreference('marketing', checked)}
                  className="ml-4"
                />
              </div>
            </div>
            
            <div className="flex justify-between gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              
              <Button
                onClick={saveCustomPreferences}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}