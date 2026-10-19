import SEOHead from "@/components/SEOHead";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useLayoutEffect, startTransition } from "react";
import { PerfMonitor } from "../utils/perfMonitor";

export default function CookiePolicy() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const start = PerfMonitor.startComponentRender('Cookie Policy');
    return () => {
      PerfMonitor.endComponentRender('Cookie Policy', start);
    };
  }, []);

  // Ensure scroll position stays at top
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <>
    <SEOHead title="Politică de Cookie-uri" description="Politica de cookie-uri EatOff - ce cookie-uri folosim și cum le poți gestiona." canonical="/cookie-policy" />
    <div lang="en" className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <button 
              onClick={() => startTransition(() => setLocation('/'))}
              className="text-primary hover:text-primary/80 font-medium inline-flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to EatOff
            </button>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-6">COOKIE POLICY</h1>
          <p className="text-sm text-gray-600 mb-8">Latest update: 30.07.2025</p>

          <div className="prose prose-lg max-w-none space-y-8">
            <p className="text-gray-700 leading-relaxed">
              This website uses both its own cookies and third-party cookies to offer visitors an optimal browsing experience and services tailored to each individual's needs and interests.
            </p>
            <p className="text-gray-700 leading-relaxed">
              In accordance with Regulation (EU) 2016/679 of the European Parliament and of the Council of April 27, 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (the "General Data Protection Regulation"), as well as with the relevant national legislation on data protection, all visitors to the website are asked for their consent before cookies are transmitted to their computers.
            </p>
            <p className="text-gray-700 leading-relaxed">
              When you visit our website, no personal data is transmitted to our server unless you actively send us such data. The only exceptions are the technically necessary cookies that are essential for our website's operation.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The Google Analytics web analysis tool is configured so that data is recorded only in anonymous form and cannot be traced back to individual persons.
            </p>
            <p className="text-gray-700 leading-relaxed">
              All other technologies from external providers (e.g., Google Maps, YouTube plug-ins) are disabled by default, so no data is transmitted to third parties when you visit our website.
            </p>
            <p className="text-gray-700 leading-relaxed">
              You have the option to accept the use of other cookies in the cookie banner or to enable external content to improve our website's functionality and content. In this case, these third-party providers may obtain your personal data.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What are cookies?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A cookie is a small text file that a website saves on your computer or mobile device when you visit it. Cookies allow the website to remember your actions and preferences (login, language, font size, and other display preferences) over a period of time. As a result, you do not need to re-enter them whenever you return to the website or navigate from one page to another.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Cookies may also contain personal data such as your IP address. Therefore, we store cookies only if you have explicitly permitted this in the cookie settings on our website. You can revoke your consent for the use of cookies at any time, with future effect, by appropriately adjusting your browser's security settings.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                The only exception is cookies that are technically essential for the operation of our website. Without them, you cannot visit or navigate the website. Hence, these cookies are generally activated by default.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                You can also generally disable cookies in your browser at any time, preventing cookies from being stored on your device. However, please note that completely disabling cookies may lead to malfunctions in the use of our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How are cookies used?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">There are three common types of cookies:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Necessary cookies:</strong> make the website functional by providing basic features such as page navigation and access to secure areas of the website. The website cannot function properly without these cookies.</li>
                <li><strong>Statistical cookies:</strong> collect and report information anonymously and help website owners understand how visitors interact with the website.</li>
                <li><strong>Marketing cookies:</strong> used to track visitors as they browse various websites. The purpose is to display relevant and engaging ads for each visitor.</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mb-4">
                There is also a category of Unclassified Cookies, which are in the process of being classified into one of the above three main categories.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Currently, the domain www.eatoff.app uses three Necessary Cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What are third-party cookies?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Certain sections of website content may be provided through third parties. These third parties may place cookies via another website, and they are referred to as "third-party cookies" because they are not placed by the owner of the respective website. These third-party providers must also comply with the applicable law and the website owner's privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How long do cookies last?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Cookies are managed by web servers. The duration of a cookie can vary significantly, depending on its purpose. Some cookies are used exclusively for a single session (session cookies) and are not retained once the visitor leaves the website, whereas other cookies are retained and reused each time the visitor returns to that website (persistent cookies). However, cookies can be deleted by a visitor at any time via the settings of the browser they use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How can you control cookies?</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You can control and/or delete cookies as you wish—for details, see https://www.aboutcookies.org. You can delete all cookies from your computer and set most browsers to block them. If you do this, you may need to manually set some preferences each time you visit the website. Also, some services or options may not function properly.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">Below are useful links for controlling cookies depending on the browser you use:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Cookies in Internet Explorer: https://support.microsoft.com/en-us/help/17442/windows-internet-explorer-delete-manage-cookies</li>
                <li>Cookies in Firefox: https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences</li>
                <li>Cookies in Chrome: https://support.google.com/chrome/answer/95647?co=GENIE.Platform%3DAndroid&hl=en</li>
                <li>Cookies in Opera: https://www.opera.com/help/tutorials/security/privacy/</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookie Details</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Below you can specifically review the cookies used by www.eatoff.app by category:
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Result of the "Cookie scan report" generated by the module used—Cookie Serve—on April 07, 2025 for the website www.eatoff.app.
              </p>
              
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Necessary cookies: 3</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Necessary cookies help a website function by enabling basic features such as page navigation and access to its secure areas. The website cannot function properly without these cookies.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Cookie</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Domain</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">PHPSESSID</td>
                        <td className="border border-gray-300 px-4 py-2">eatoff.app</td>
                        <td className="border border-gray-300 px-4 py-2">Necessary</td>
                        <td className="border border-gray-300 px-4 py-2">Session</td>
                        <td className="border border-gray-300 px-4 py-2">This cookie is native to PHP applications. The cookie is used to store and identify a users' unique session ID for the purpose of managing user session on the website. The cookie is a session cookies and is deleted when all the browser windows are closed.</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">rc::a</td>
                        <td className="border border-gray-300 px-4 py-2">google.com</td>
                        <td className="border border-gray-300 px-4 py-2">Necessary</td>
                        <td className="border border-gray-300 px-4 py-2">Never</td>
                        <td className="border border-gray-300 px-4 py-2">This cookie is set by the Google recaptcha service to identify bots to protect the website against malicious spam attacks.</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">rc::c</td>
                        <td className="border border-gray-300 px-4 py-2">google.com</td>
                        <td className="border border-gray-300 px-4 py-2">Necessary</td>
                        <td className="border border-gray-300 px-4 py-2">Session</td>
                        <td className="border border-gray-300 px-4 py-2">This cookie is set by the Google recaptcha service to identify bots to protect the website against malicious spam attacks.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Cookies Policy complemented by Privacy Policy</strong>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}