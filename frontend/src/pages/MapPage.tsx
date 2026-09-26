import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { mockParcels } from '../api/mockData';
import { StatusBadge } from '../components/shared';
import type {
  ParcelPin,
  RecordStatus,
} from '../api/types';
import 'leaflet/dist/leaflet.css';

/* =========================================================
   LEAFLET DEFAULT ICON FIX
   ========================================================= */

delete (
  L.Icon.Default.prototype as unknown as Record<string, unknown>
)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* =========================================================
   STATUS COLORS
   ========================================================= */

const statusColors: Record<RecordStatus, string> = {
  verified: '#0F9D58',
  pending_review: '#F59E0B',
  in_review: '#F59E0B',
  flagged: '#D93025',
  discrepancy: '#D93025',
  locked: '#767683',
};

/* =========================================================
   MAP FILTER
   ========================================================= */

type MapFilter =
  | 'all'
  | 'verified'
  | 'pending_review'
  | 'flagged'
  | 'locked';

/* =========================================================
   MARKER ICON
   ========================================================= */

function createColoredIcon(status: RecordStatus) {
  const color = statusColors[status];

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div
        style="
          width:18px;
          height:18px;
          border-radius:50%;
          background:${color};
          border:3px solid white;
          box-shadow:0 2px 7px rgba(15,23,42,0.25);
        "
      ></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* =========================================================
   MAP INTERACTION CONTROLLER
   ========================================================= */

function MapInteractionController({
  active,
}: {
  active: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (active) {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    } else {
      map.scrollWheelZoom.disable();
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }
  }, [active, map]);

  return null;
}

/* =========================================================
   MAP ACTIVATION
   ========================================================= */

/*
 * IMPORTANT:
 * Do not use "touchstart" here.
 *
 * react-leaflet's useMapEvents typings do not expose
 * touchstart as a valid map event.
 *
 * The document-level touchstart listener below handles
 * outside-map taps separately.
 */

function MapActivation({
  onActivate,
}: {
  onActivate: () => void;
}) {
  useMapEvents({
    click() {
      onActivate();
    },
  });

  return null;
}

/* =========================================================
   FLY TO SELECTED PARCEL
   ========================================================= */

function FlyToParcel({
  parcel,
}: {
  parcel: ParcelPin | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!parcel) {
      return;
    }

    map.flyTo(
      [parcel.lat, parcel.lng],
      15,
      {
        duration: 0.7,
      },
    );
  }, [map, parcel]);

  return null;
}

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function MapPage() {
  const navigate = useNavigate();

  /*
   * Reference to the complete map area.
   *
   * This is used to determine whether a click/tap
   * happened inside or outside the map.
   */
  const mapWrapperRef =
    useRef<HTMLDivElement | null>(null);

  const [selectedParcel, setSelectedParcel] =
    useState<ParcelPin | null>(null);

  const [filter, setFilter] =
    useState<MapFilter>('all');

  const [search, setSearch] =
    useState('');

  /*
   * Map is intentionally inactive initially.
   */
  const [mapActive, setMapActive] =
    useState(false);

  /* =======================================================
     OUTSIDE MAP CLICK / TAP DETECTION
     ======================================================= */

  useEffect(() => {
    function handleOutsideInteraction(
      event: MouseEvent | TouchEvent,
    ) {
      const target = event.target as Node | null;

      if (
        mapWrapperRef.current &&
        target &&
        !mapWrapperRef.current.contains(target)
      ) {
        setMapActive(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideInteraction,
    );

    document.addEventListener(
      'touchstart',
      handleOutsideInteraction,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideInteraction,
      );

      document.removeEventListener(
        'touchstart',
        handleOutsideInteraction,
      );
    };
  }, []);

  /* =======================================================
     FILTER PARCELS
     ======================================================= */

  const filteredParcels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mockParcels.filter((parcel) => {
      const matchesSearch =
        query === '' ||
        parcel.khasraNo
          .toLowerCase()
          .includes(query) ||
        parcel.ownerName
          .toLowerCase()
          .includes(query) ||
        parcel.village
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === 'all' ||
        parcel.status === filter ||
        (filter === 'pending_review' &&
          parcel.status === 'in_review') ||
        (filter === 'flagged' &&
          parcel.status === 'discrepancy');

      return matchesSearch && matchesFilter;
    });
  }, [filter, search]);

  /* =======================================================
     SUMMARY COUNTS
     ======================================================= */

  const verifiedCount = mockParcels.filter(
    (parcel) =>
      parcel.status === 'verified',
  ).length;

  const reviewCount = mockParcels.filter(
    (parcel) =>
      parcel.status === 'pending_review' ||
      parcel.status === 'in_review',
  ).length;

  const flaggedCount = mockParcels.filter(
    (parcel) =>
      parcel.status === 'flagged' ||
      parcel.status === 'discrepancy',
  ).length;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="flex w-full flex-col gap-5">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Geographic View
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface">
            Parcel Map
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Explore digitized land parcels by location and
            verification status.
          </p>

        </div>

        <button
          type="button"
          onClick={() => navigate('/queue')}
          className="min-h-11 w-fit rounded-lg border border-outline-variant px-4 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
        >
          Back to Queue
        </button>

      </header>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">

        <MapSummary
          label="Total Parcels"
          value={mockParcels.length}
          description="Visible in the current dataset"
        />

        <MapSummary
          label="Verified"
          value={verifiedCount}
          description="Verified parcel records"
          success
        />

        <MapSummary
          label="Needs Attention"
          value={reviewCount + flaggedCount}
          description="Pending review or flagged"
          warning
        />

      </section>

      {/* =====================================================
          SEARCH + FILTER
      ===================================================== */}

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">

        <div className="flex flex-col gap-3 lg:flex-row">

          <div className="relative flex-1">

            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[19px] text-outline">
              search
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search Khasra, owner, or village..."
              className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
            />

          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value as MapFilter,
              )
            }
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 lg:w-52"
          >

            <option value="all">
              All Status
            </option>

            <option value="verified">
              Verified
            </option>

            <option value="pending_review">
              Pending / In Review
            </option>

            <option value="flagged">
              Flagged / Discrepancy
            </option>

            <option value="locked">
              Locked
            </option>

          </select>

        </div>

      </section>

      {/* =====================================================
          MAP + SIDE PANEL
      ===================================================== */}

      <section className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_18px_rgba(15,23,42,0.05)] xl:grid-cols-[minmax(0,1fr)_340px]">

        {/* ===================================================
            MAP
        =================================================== */}

        <div
          ref={mapWrapperRef}
          className="relative min-h-[500px] xl:min-h-[620px]"
        >

          <MapContainer
            center={[26.8467, 80.9462]}
            zoom={12}

            /*
             * Map begins completely passive.
             */
            scrollWheelZoom={false}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}

            className="h-full min-h-[500px] w-full"
          >

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapInteractionController
              active={mapActive}
            />

            <MapActivation
              onActivate={() =>
                setMapActive(true)
              }
            />

            <FlyToParcel
              parcel={selectedParcel}
            />

            {filteredParcels.map((parcel) => (

              <Marker
                key={parcel.id}
                position={[
                  parcel.lat,
                  parcel.lng,
                ]}
                icon={createColoredIcon(
                  parcel.status,
                )}
                eventHandlers={{
                  click: () => {
                    setSelectedParcel(parcel);
                    setMapActive(true);
                  },
                }}
              >

                <Popup>

                  <div className="min-w-[190px]">

                    <p className="font-mono text-xs font-bold text-primary">
                      {parcel.khasraNo}
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {parcel.ownerName}
                    </p>

                    <p className="mt-1 text-xs text-gray-600">
                      {parcel.village}
                    </p>

                    <div className="mt-3">

                      <span
                        className="inline-block rounded-md px-2 py-1 text-[10px] font-semibold"
                        style={{
                          background:
                            `${statusColors[parcel.status]}18`,
                          color:
                            statusColors[parcel.status],
                        }}
                      >
                        {formatStatus(
                          parcel.status,
                        )}
                      </span>

                    </div>

                  </div>

                </Popup>

              </Marker>

            ))}

          </MapContainer>

          {/* =================================================
              PASSIVE MAP OVERLAY
          ================================================= */}

          {!mapActive && (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">

              <div className="rounded-xl border border-outline-variant bg-white/95 px-5 py-4 text-center shadow-lg backdrop-blur">

                <p className="text-sm font-semibold text-on-surface">
                  Tap the map to interact
                </p>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Tap once to enable zoom and navigation.
                </p>

              </div>

            </div>
          )}

          {/* =================================================
              MAP LABEL
          ================================================= */}

          <div className="pointer-events-none absolute left-4 top-4 z-[400] rounded-lg border border-outline-variant bg-white/95 px-3 py-2 shadow-sm backdrop-blur">

            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-outline">
              Map View
            </p>

            <p className="mt-0.5 text-xs font-semibold text-on-surface">
              {filteredParcels.length} parcel
              {filteredParcels.length === 1
                ? ''
                : 's'}
            </p>

          </div>

          {/* =================================================
              ACTIVE INDICATOR
          ================================================= */}

          {mapActive && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-md bg-white/90 px-3 py-2 shadow-sm backdrop-blur">

              <p className="text-[10px] font-medium text-on-surface-variant">
                Map interaction enabled
              </p>

            </div>
          )}

        </div>

        {/* ===================================================
            SIDE PANEL
        =================================================== */}

        <aside className="flex max-h-[620px] flex-col border-t border-outline-variant bg-surface-container-lowest xl:border-l xl:border-t-0">

          <div className="border-b border-outline-variant px-5 py-4">

            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
              Parcels
            </p>

            <h2 className="mt-1 text-lg font-bold text-on-surface">
              Current Selection
            </h2>

          </div>

          {/* =================================================
              SELECTED PARCEL
          ================================================= */}

          {selectedParcel ? (

            <div className="border-b border-outline-variant p-5">

              <p className="font-mono text-sm font-bold text-primary">
                {selectedParcel.khasraNo}
              </p>

              <p className="mt-2 text-base font-semibold text-on-surface">
                {selectedParcel.ownerName}
              </p>

              <p className="mt-1 text-xs text-on-surface-variant">
                {selectedParcel.village}
              </p>

              <div className="mt-4">

                <StatusBadge
                  status={selectedParcel.status}
                />

              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">

                <InfoItem
                  label="Area"
                  value={`${selectedParcel.area}`}
                />

                <InfoItem
                  label="Latitude"
                  value={selectedParcel.lat.toFixed(4)}
                />

                <InfoItem
                  label="Longitude"
                  value={selectedParcel.lng.toFixed(4)}
                />

                <InfoItem
                  label="Record"
                  value={selectedParcel.id}
                />

              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/records/${selectedParcel.id}`,
                  )
                }
                className="mt-4 min-h-11 w-full rounded-lg bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-container"
              >
                Open Record
              </button>

            </div>

          ) : (

            <div className="border-b border-outline-variant px-5 py-8 text-center">

              <p className="text-sm font-semibold text-on-surface">
                Select a parcel
              </p>

              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Select a marker on the map to view
                parcel information.
              </p>

            </div>

          )}

          {/* =================================================
              PARCEL LIST
          ================================================= */}

          <div className="flex-1 overflow-y-auto">

            {filteredParcels.length > 0 ? (

              <div className="divide-y divide-outline-variant">

                {filteredParcels.map((parcel) => (

                  <button
                    key={parcel.id}
                    type="button"
                    onClick={() => {
                      setSelectedParcel(parcel);
                      setMapActive(true);
                    }}
                    className={[
                      'w-full px-5 py-4 text-left transition-colors hover:bg-surface-container-low',
                      selectedParcel?.id ===
                        parcel.id
                        ? 'bg-primary-fixed/40'
                        : '',
                    ].join(' ')}
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <p className="font-mono text-xs font-semibold text-primary">
                          {parcel.khasraNo}
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-on-surface">
                          {parcel.ownerName}
                        </p>

                        <p className="mt-1 truncate text-[11px] text-on-surface-variant">
                          {parcel.village}
                        </p>

                      </div>

                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            statusColors[
                            parcel.status
                            ],
                        }}
                      />

                    </div>

                  </button>

                ))}

              </div>

            ) : (

              <div className="px-5 py-10 text-center">

                <p className="text-sm font-semibold text-on-surface">
                  No parcels found
                </p>

                <p className="mt-1 text-xs text-on-surface-variant">
                  Try another search or status filter.
                </p>

              </div>

            )}

          </div>

        </aside>

      </section>

      {/* =====================================================
          LEGEND
      ===================================================== */}

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4">

        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
          Status
        </span>

        <LegendItem
          label="Verified"
          color={statusColors.verified}
        />

        <LegendItem
          label="Pending / Review"
          color={statusColors.pending_review}
        />

        <LegendItem
          label="Flagged / Discrepancy"
          color={statusColors.flagged}
        />

        <LegendItem
          label="Locked"
          color={statusColors.locked}
        />

      </section>

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function MapSummary({
  label,
  value,
  description,
  warning = false,
  success = false,
}: {
  label: string;
  value: number;
  description: string;
  warning?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">

      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-outline">
        {label}
      </p>

      <p
        className={[
          'mt-2 font-mono text-2xl font-bold',
          warning
            ? 'text-amber-700'
            : success
              ? 'text-emerald-700'
              : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   INFO ITEM
   ========================================================= */

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5">

      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-outline">
        {label}
      </p>

      <p className="mt-1 truncate font-mono text-[10px] font-semibold text-on-surface">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   LEGEND ITEM
   ========================================================= */

function LegendItem({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">

      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />

      <span className="text-xs text-on-surface-variant">
        {label}
      </span>

    </div>
  );
}

/* =========================================================
   STATUS FORMATTER
   ========================================================= */

function formatStatus(status: RecordStatus) {
  switch (status) {
    case 'pending_review':
      return 'Pending Review';

    case 'in_review':
      return 'In Review';

    case 'verified':
      return 'Verified';

    case 'flagged':
      return 'Flagged';

    case 'discrepancy':
      return 'Discrepancy';

    case 'locked':
      return 'Locked';

    default:
      return status;
  }
}