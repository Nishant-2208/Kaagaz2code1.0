import {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  GoogleLogin,
} from '@react-oauth/google';

import { useAuth } from '../contexts/AuthContext';

import type {
  UserRole,
} from '../api/types';


type Role =
  Exclude<
    UserRole,
    'reviewer'
  >;


interface RoleConfig {
  role: Role;
  label: string;
  badge: string;
  icon: string;
  defaultId: string;
  route: string;
  description: string;
}


const ROLES: RoleConfig[] = [
  {
    role: 'officer',
    label: 'Revenue Officer',
    badge: 'Khatoni & RoR Audits',
    icon: 'badge',
    defaultId: 'officer@kaagaz.dev',
    route: '/upload',
    description:
      'Digitize legacy deeds, review OCR extractions, and resolve discrepancies.',
  },

  {
    role: 'admin',
    label: 'Administrator',
    badge: 'System Governance',
    icon: 'admin_panel_settings',
    defaultId: 'admin@kaagaz.dev',
    route: '/admin',
    description:
      'Monitor pipeline throughput, manage queues, and oversee audit logs.',
  },

  {
    role: 'citizen',
    label: 'Citizen / Public',
    badge: 'Open Registry',
    icon: 'public',
    defaultId: '',
    route: '/lookup',
    description:
      'Search verified Khasra parcels, cadastral maps, and mutation status.',
  },
];


export default function LoginPage() {
  const navigate =
    useNavigate();

  const {
    login,
    completeGoogleLogin,
  } = useAuth();


  const [selectedRole, setSelectedRole] =
    useState<Role>('officer');

  const [userId, setUserId] =
    useState('officer@kaagaz.dev');

  const [password, setPassword] =
    useState('Officer@123');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isGoogleSubmitting, setIsGoogleSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';


  // =======================================================
  // DESTINATION
  // =======================================================

  function getDestination(
    role: UserRole,
  ): string {

    switch (role) {

      case 'admin':
        return '/admin';

      case 'reviewer':
        return '/review';

      case 'officer':
        return '/upload';

      case 'citizen':
      default:
        return '/lookup';
    }
  }


  // =======================================================
  // GOOGLE REDIRECT HANDLER
  // =======================================================

  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search,
      );


    /*
     * URLSearchParams.get() returns:
     *
     * string | null
     *
     * Explicitly validate it before passing it
     * to completeGoogleLogin().
     */
    const codeParam =
      params.get('code');


    if (
      typeof codeParam !== 'string' ||
      codeParam.length === 0
    ) {
      return;
    }


    /*
     * From this point onward TypeScript knows
     * this is a real string.
     */
    const code: string =
      codeParam;


    let cancelled = false;


    async function completeRedirectLogin() {

      setError('');

      setIsGoogleSubmitting(
        true,
      );


      try {

        const user =
          await completeGoogleLogin(
            code,
          );


        if (cancelled) {
          return;
        }


        /*
         * Remove the one-time Google exchange
         * code from the browser URL.
         */
        window.history.replaceState(
          {},
          document.title,
          '/login',
        );


        navigate(
          getDestination(
            user.role,
          ),
          {
            replace: true,
          },
        );


      } catch (googleError) {

        console.error(
          'Google redirect login failed:',
          googleError,
        );


        if (!cancelled) {

          setError(
            googleError instanceof Error
              ? googleError.message
              : 'Google sign-in failed. Please try again.',
          );
        }


      } finally {

        if (!cancelled) {

          setIsGoogleSubmitting(
            false,
          );
        }
      }
    }


    void completeRedirectLogin();


    return () => {
      cancelled = true;
    };


  }, [
    completeGoogleLogin,
    navigate,
  ]);


  // =======================================================
  // ROLE SWITCH
  // =======================================================

  function handleRoleSwitch(
    role: Role,
  ) {

    setSelectedRole(
      role,
    );


    const target =
      ROLES.find(
        (r) =>
          r.role === role,
      );


    if (target) {

      setUserId(
        target.defaultId,
      );


      setPassword(
        role === 'citizen'
          ? ''
          : 'Officer@123',
      );
    }


    setError('');
  }


  // =======================================================
  // NORMAL LOGIN
  // =======================================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {

    event.preventDefault();


    setError('');


    setIsSubmitting(
      true,
    );


    try {

      const user =
        await login(
          userId,
          password,
        );


      navigate(
        getDestination(
          user.role,
        ),
      );


    } catch (
    loginError
    ) {

      console.error(
        'Login failed:',
        loginError,
      );


      setError(
        'Sign-in failed. Check your Service ID and Authorization Passkey.',
      );


    } finally {

      setIsSubmitting(
        false,
      );
    }
  }


  // =======================================================
  // GOOGLE BUTTON ERROR
  // =======================================================

  function handleGoogleError() {

    setError(
      'Google sign-in was cancelled or failed.',
    );
  }


  /*
   * IMPORTANT:
   *
   * @react-oauth/google currently requires
   * onSuccess in its TypeScript props.
   *
   * In redirect mode, Google sends the credential
   * directly to login_uri, so this callback is not
   * used for the actual authentication flow.
   *
   * We keep an empty callback only to satisfy
   * the installed package's TypeScript definition.
   */
  function handleGoogleSuccess(): void {
    return;
  }


  const activeConfig =
    ROLES.find(
      (r) =>
        r.role ===
        selectedRole,
    )!;


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-[1040px] items-center justify-center px-4 py-6 sm:px-6">

      <div className="grid w-full grid-cols-1 items-center gap-8 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:p-10">


        {/* =================================================
            LEFT PANEL
        ================================================= */}

        <div className="flex h-full flex-col justify-between border-b border-outline-variant/60 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">

          <div className="space-y-4">


            <div className="flex items-center -ml-3">

              <img
                src="/logo.jpeg"
                alt="Kaagaz2Code Logo"
                className="h-28 w-auto max-w-[340px] object-contain drop-shadow-xs"
              />

            </div>


            <div className="space-y-1.5">

              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                National Land Records Modernization
              </p>


              <p className="text-sm leading-relaxed text-on-surface-variant">
                Digitize legacy revenue deeds, extract multi-script Khatoni records with AI, and verify cadastral GIS boundaries on a secure platform.
              </p>

            </div>


            <div className="flex flex-wrap gap-2 pt-2">


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  document_scanner
                </span>

                OpenCV + Tesseract OCR

              </span>


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  layers
                </span>

                Cadastral GIS Mapping

              </span>


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  verified
                </span>

                Audit Traceability

              </span>


            </div>

          </div>


          <div className="mt-8 flex items-center justify-between border-t border-outline-variant/50 pt-4 text-[11px] text-outline">

            <span>
              Ministry of Rural Development • Land Resources
            </span>


            <span className="font-medium">
              Government of India
            </span>

          </div>

        </div>


        {/* =================================================
            RIGHT PANEL
        ================================================= */}

        <div className="flex flex-col justify-center lg:pl-2">


          <div className="mb-5">

            <h2 className="font-headline text-xl font-bold text-on-surface">
              Access Workspace
            </h2>


            <p className="mt-0.5 text-xs text-on-surface-variant">
              Select your authorization role to enter the secure portal.
            </p>

          </div>


          {/* =================================================
              ROLE SELECTOR
          ================================================= */}

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-outline-variant/70 bg-surface-container-low p-1.5">


            {ROLES.map(
              (role) => {

                const isActive =
                  selectedRole ===
                  role.role;


                return (

                  <button
                    key={role.role}
                    type="button"
                    onClick={() =>
                      handleRoleSwitch(
                        role.role,
                      )
                    }
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center transition-all ${isActive
                        ? 'bg-primary text-on-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                  >

                    <span className="material-symbols-outlined text-xl">
                      {role.icon}
                    </span>


                    <span className="text-[11px] font-medium leading-tight">
                      {role.label}
                    </span>

                  </button>

                );
              },
            )}

          </div>


          {/* =================================================
              ROLE STATUS
          ================================================= */}

          <div className="mt-4 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">

            <div className="flex items-center justify-between">

              <span className="text-xs font-bold text-on-surface">
                {activeConfig.label}
              </span>


              <span className="rounded bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary">
                {activeConfig.badge}
              </span>

            </div>


            <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
              {activeConfig.description}
            </p>

          </div>


          {/* =================================================
              GOOGLE LOGIN
          ================================================= */}

          {googleClientId && (
            <div className="mt-5">


            {isGoogleSubmitting ? (

              <div className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 text-xs font-semibold text-on-surface">

                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>


                Signing in with Google…

              </div>

            ) : (

              <div className="flex w-full justify-center">


                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  ux_mode="redirect"
                  login_uri="http://localhost:8000/api/v1/auth/google"
                  use_fedcm_for_button={false}
                  theme="outline"
                  size="large"
                  width="400"
                />


              </div>

            )}


            <p className="mt-2 text-center text-[10px] text-outline">
              Sign in securely with your Google account
            </p>

          </div>
          )}


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (

            <div
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-lg border border-error bg-error-container px-3 py-2.5 text-[11px] font-medium text-on-error-container"
            >

              <span className="material-symbols-outlined text-base">
                error
              </span>


              {error}

            </div>

          )}


          {/* =================================================
              OFFICIAL ACCESS
          ================================================= */}

          {selectedRole !==
            'citizen' && (

              <>


                <div className="my-5 flex items-center gap-3">

                  <div className="h-px flex-1 bg-outline-variant/60" />


                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-outline">
                    or official access
                  </span>


                  <div className="h-px flex-1 bg-outline-variant/60" />

                </div>


                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-4"
                >


                  {/* USER ID */}

                  <div>

                    <label
                      htmlFor="user-id"
                      className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                    >
                      Official Service ID / Pen No.
                    </label>


                    <div className="relative">

                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline">

                        <span className="material-symbols-outlined text-lg">
                          badge
                        </span>

                      </span>


                      <input
                        id="user-id"
                        type="text"
                        required
                        value={
                          userId
                        }
                        onChange={(
                          event,
                        ) =>
                          setUserId(
                            event.target
                              .value,
                          )
                        }
                        className="w-full rounded-lg border border-outline-variant bg-surface py-2.5 pl-9 pr-3 text-xs text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />

                    </div>

                  </div>


                  {/* PASSWORD */}

                  <div>

                    <div className="mb-1 flex items-center justify-between">


                      <label
                        htmlFor="password"
                        className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                      >
                        Authorization Passkey
                      </label>


                      <button
                        type="button"
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Forgot Key?
                      </button>


                    </div>


                    <div className="relative">


                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline">

                        <span className="material-symbols-outlined text-lg">
                          lock
                        </span>

                      </span>


                      <input
                        id="password"
                        type="password"
                        required
                        value={
                          password
                        }
                        onChange={(
                          event,
                        ) =>
                          setPassword(
                            event.target
                              .value,
                          )
                        }
                        className="w-full rounded-lg border border-outline-variant bg-surface py-2.5 pl-9 pr-3 text-xs text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />


                    </div>

                  </div>


                  {/* SUBMIT */}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting
                    }
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.06em] text-on-primary shadow-xs transition hover:opacity-95 disabled:opacity-50"
                  >


                    {isSubmitting ? (

                      <>

                        <span className="material-symbols-outlined animate-spin text-base">
                          progress_activity
                        </span>


                        Authenticating Session…

                      </>

                    ) : (

                      <>

                        <span className="material-symbols-outlined text-base">
                          login
                        </span>


                        Enter Secure Workspace

                      </>

                    )}


                  </button>


                </form>

              </>

            )}


          {/* =================================================
              CITIZEN
          ================================================= */}

          {selectedRole ===
            'citizen' && (

              <div className="mt-5 space-y-4">


                <div className="rounded-lg border border-primary/20 bg-primary-fixed/30 p-4">

                  <p className="text-xs font-bold text-on-surface">
                    Public Cadastral Search
                  </p>


                  <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
                    Access digital Khasra maps, search by Khatoni number, and verify ownership records publicly without government credentials.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/lookup',
                    )
                  }
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.06em] text-on-primary shadow-xs transition hover:opacity-95"
                >

                  <span>
                    Proceed to Public Records Lookup
                  </span>


                  <span className="material-symbols-outlined text-base">
                    arrow_forward
                  </span>

                </button>


              </div>

            )}


          {/* SECURITY FOOTER */}

          <div className="mt-5 flex items-center justify-center gap-1 text-[11px] text-outline">

            <span className="material-symbols-outlined text-xs">
              lock
            </span>


            Encrypted End-to-End • 256-Bit SSL Secured

          </div>


        </div>

      </div>

    </div>
  );
}