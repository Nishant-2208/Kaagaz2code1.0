import {
  useEffect,
  useState,
} from 'react';

import { GoogleLogin } from '@react-oauth/google';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import type {
  UserRole,
} from '../api/types';


type Role = UserRole;


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
    badge: 'Land Record Processing',
    icon: 'badge',
    defaultId: 'officer@kaagaz.dev',
    route: '/upload',
    description:
      'Digitize land records, review AI-extracted fields, and resolve validation discrepancies.',
  },

  {
    role: 'admin',
    label: 'Administrator',
    badge: 'System Governance',
    icon: 'admin_panel_settings',
    defaultId: 'admin@kaagaz.dev',
    route: '/admin',
    description:
      'Monitor processing workflows, manage access, and oversee audit activity.',
  },

  {
    role: 'reviewer',
    label: 'Reviewer',
    badge: 'Verification Desk',
    icon: 'fact_check',
    defaultId: 'reviewer@kaagaz.dev',
    route: '/review',
    description:
      'Validate AI-extracted fields, resolve discrepancies, and approve verified records.',
  },

  {
    role: 'citizen',
    label: 'Citizen / Public',
    badge: 'Open Registry',
    icon: 'public',
    defaultId: 'citizen@kaagaz.dev',
    route: '/lookup',
    description:
      'Search verified land records, cadastral information, and record status.',
  },
];


export default function LoginPage() {
  const navigate =
    useNavigate();

  const {
    login,
    completeGoogleLogin,
  } = useAuth();

  const [searchParams, setSearchParams] =
    useSearchParams();

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';


  const [selectedRole, setSelectedRole] =
    useState<Role>('officer');

  const [userId, setUserId] =
    useState('officer@kaagaz.dev');

  const [password, setPassword] =
    useState('Officer@123');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [isGoogleSubmitting, setIsGoogleSubmitting] =
    useState(false);


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
        loginError instanceof Error
          ? loginError.message
          : 'Sign-in failed. Please verify the selected role and try again.',
      );


    } finally {

      setIsSubmitting(
        false,
      );
    }
  }


  // =======================================================
  // GOOGLE REDIRECT RETURN
  // =======================================================

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code || isGoogleSubmitting) return;

    let cancelled = false;

    async function finishGoogleLogin() {
      setError('');
      setIsGoogleSubmitting(true);

      try {
        const user = await completeGoogleLogin(code);

        if (cancelled) return;

        setSearchParams({}, { replace: true });
        navigate(getDestination(user.role), { replace: true });
      } catch (googleError) {
        if (!cancelled) {
          setError(
            googleError instanceof Error
              ? googleError.message
              : 'Google sign-in could not be completed.',
          );
          setSearchParams({}, { replace: true });
        }
      } finally {
        if (!cancelled) {
          setIsGoogleSubmitting(false);
        }
      }
    }

    void finishGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [
    completeGoogleLogin,
    isGoogleSubmitting,
    navigate,
    searchParams,
    setSearchParams,
  ]);


  // =======================================================
  // GOOGLE BUTTON ERROR
  // =======================================================

  function handleGoogleError() {

    setError(
      'Google sign-in was cancelled or failed.',
    );
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
    <div className="mx-auto flex min-h-[calc(100vh-110px)] w-full max-w-[1180px] items-center justify-center px-4 py-8 sm:px-6 lg:py-12">

      <div className="grid w-full grid-cols-1 items-stretch gap-0 overflow-hidden rounded-[28px] border border-outline-variant/70 bg-white shadow-[0_20px_60px_rgba(11,45,85,0.10)] lg:grid-cols-[0.92fr_1.08fr]">


        {/* =================================================
            LEFT PANEL
        ================================================= */}

        <div className="flex h-full flex-col justify-between border-b border-outline-variant/60 bg-[linear-gradient(145deg,#eef4fb_0%,#f8fafc_58%,#fff9f1_100%)] p-6 pb-7 lg:border-b-0 lg:border-r lg:p-10">

          <div className="space-y-4">


            <div className="flex items-center gap-4 -ml-1">

              <img
                src="/7c8c5500-3a65-4189-b42f-07d6d77a0f26.jpg"
                alt="Kaagaz2Code Logo"
                className="h-24 w-24 shrink-0 rounded-xl object-contain drop-shadow-sm sm:h-28 sm:w-28"
              />

              <div className="min-w-0">
                <h1 className="font-headline text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  Kaagaz2Code
                </h1>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant sm:text-[11px]">
                  AI-Powered Land Record Digitization & Validation
                </p>
              </div>

            </div>


            <div className="space-y-1.5">

              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                AI-POWERED LAND RECORD DIGITIZATION & VALIDATION
              </p>


              <p className="text-sm leading-relaxed text-on-surface-variant">
                Digitize legacy land records, extract structured fields with AI-powered OCR, detect inconsistencies, and maintain secure, auditable digital records.
              </p>

            </div>


            <div className="flex flex-wrap gap-2 pt-2">


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  document_scanner
                </span>

                OpenCV + PaddleOCR

              </span>


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  auto_awesome
                </span>

                AI Field Extraction

              </span>


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  rule
                </span>

                Validation & Discrepancy Detection

              </span>


              <span className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">

                <span className="material-symbols-outlined text-sm text-primary">
                  verified
                </span>

                Audit-Ready Records

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

        <div className="flex flex-col justify-center p-6 lg:p-10">


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

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-outline-variant/70 bg-[#f4f6f9] p-1.5 sm:grid-cols-4">


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
                        ? 'bg-primary text-on-primary shadow-sm font-semibold ring-1 ring-primary/10'
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

          <div className="mt-4 rounded-xl border border-primary/10 bg-primary-fixed/40 p-4">

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


          <div className="mt-5 rounded-xl border border-secondary/15 bg-secondary-fixed/45 px-4 py-3">
            <p className="text-[11px] leading-5 text-on-surface-variant">
              Development access is enabled for local integration testing. Password input is retained for the UI; authentication is handled by the FastAPI development login endpoint.
            </p>
          </div>


          {/* =================================================
              GOOGLE ACCESS
          ================================================= */}

          <div className="mt-5">
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant/60" />
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-outline">
                or sign in with Google
              </span>
              <div className="h-px flex-1 bg-outline-variant/60" />
            </div>

            {googleClientId ? (
              <div className="flex w-full justify-center">
                <GoogleLogin
                  onSuccess={() => undefined}
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
            ) : (
              <div className="rounded-xl border border-[#f2d3a8] bg-[#fff7e9] px-3 py-2.5 text-center text-[11px] leading-5 text-[#7a4b0b]">
                Google sign-in is ready, but the frontend Google client ID
                is not configured in <span className="font-mono">.env</span>.
              </div>
            )}

            <p className="mt-2 text-center text-[10px] text-outline">
              Secure Google authentication • redirected through FastAPI
            </p>
          </div>



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
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-[0.06em] text-on-primary shadow-sm transition hover:bg-primary-container hover:shadow-md disabled:opacity-50"
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
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0b2d55] px-4 text-xs font-bold uppercase tracking-[0.06em] text-white shadow-xs transition hover:bg-[#123f73]"
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