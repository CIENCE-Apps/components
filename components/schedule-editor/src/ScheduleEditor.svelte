<svelte:options tag="nylas-schedule-editor" />

<script lang="ts">
  import { DefaultCustomFields } from "@commons/constants/custom-fields";
  import { NotificationMode } from "@commons/enums/Scheduler";
  import parseStringToArray, {
    buildInternalProps,
  } from "@commons/methods/component";
  import { weekdays } from "@commons/methods/datetime";
  import type { AvailabilityRule, TimeSlot } from "@commons/types/Availability";
  import type {
    Manifest,
    EventDefinition,
  } from "@commons/types/ScheduleEditor";
  import type { CustomField } from "@commons/types/Scheduler";
  import { onMount, tick } from "svelte";
  import timezones from "timezones-list";
  import { ManifestStore } from "../../../commons/src";
  import { saveManifest } from "@commons/connections/manifest";
  import "../../availability/src/Availability.svelte";
  import "../../scheduler/src/Scheduler.svelte";

  export let id: string = "";
  export let access_token: string = "";

  export let allow_booking: boolean;
  export let attendees_to_show: number;
  export let capacity: number | null;
  export let custom_fields: CustomField[];
  export let dates_to_show: number;
  export let end_hour: number;
  export let mandate_top_of_hour: boolean;
  export let max_bookable_slots: number;
  export let max_book_ahead_days: number;
  export let min_book_ahead_days: number;
  export let notification_message: string;
  export let notification_mode: NotificationMode;
  export let notification_subject: string;
  export let open_hours: AvailabilityRule[];
  export let partial_bookable_ratio: number;
  export let recurrence: "none" | "required" | "optional";
  export let recurrence_cadence: (
    | "none"
    | "daily"
    | "weekdays"
    | "weekly"
    | "biweekly"
    | "monthly"
  )[];
  export let show_as_week: boolean;
  export let show_preview: boolean;
  export let show_ticks: boolean;
  export let show_weekends: boolean;
  export let start_date: Date;
  export let start_hour: number;
  export let view_as: "schedule" | "list";
  export let screen_bookings: boolean;
  export let timezone: string;
  export let events: EventDefinition[];

  const eventTemplate: EventDefinition = {
    event_title: "",
    event_description: "",
    slot_size: 15,
    event_location: "",
    event_conferencing: "",
    email_ids: [],
    host_rules: {
      method: "all",
    },
  };

  const defaultValueMap: Partial<Manifest> = {
    allow_booking: false,
    attendees_to_show: 5,
    capacity: null,
    custom_fields: DefaultCustomFields,
    dates_to_show: 1,
    end_hour: 17,
    mandate_top_of_hour: false,
    max_bookable_slots: 1,
    max_book_ahead_days: 30,
    min_book_ahead_days: 0,
    notification_message: "Thank you for scheduling!",
    notification_mode: NotificationMode.SHOW_MESSAGE,
    notification_subject: "Invitation",
    open_hours: [],
    partial_bookable_ratio: 0.01,
    recurrence_cadence: ["none"],
    recurrence: "none",
    show_as_week: false,
    show_ticks: true,
    show_weekends: true,
    start_date: new Date(),
    start_hour: 9,
    view_as: "schedule",
    screen_bookings: false,
    timezone: "",
    events: [{ ...eventTemplate }],
  };

  //#region mount and prop initialization
  let _this = <Manifest>buildInternalProps({}, {}, defaultValueMap);
  let initialized = false;
  let manifest: Partial<Manifest> = {};
  onMount(async () => {
    await tick();
    const storeKey = JSON.stringify({ component_id: id, access_token });
    manifest = (await $ManifestStore[storeKey]) || {};

    _this = buildInternalProps($$props, manifest, defaultValueMap) as Manifest;
    transformPropertyValues();
    initialized = true;
  });

  let previousProps = $$props;
  $: {
    if (JSON.stringify(previousProps) !== JSON.stringify($$props)) {
      _this = buildInternalProps(
        $$props,
        manifest,
        defaultValueMap,
      ) as Manifest;
      transformPropertyValues();
      previousProps = $$props;
    }
  }

  // Properties requiring further manipulation:
  let startDate: string = new Date().toLocaleDateString("en-CA");

  function transformPropertyValues() {
    startDate = _this.start_date?.toLocaleDateString("en-CA");
  }

  $: {
    _this.start_date = new Date(
      new Date(startDate).getTime() -
        new Date(startDate).getTimezoneOffset() * -60000,
    );
  }
  // #endregion mount and prop initialization

  function saveProperties() {
    saveManifest({
      id,
      access_token,
      manifest: { settings: { ..._this } },
    });
  }

  // #region unpersisted variables
  function availabilityChosen(event: any) {
    _this.open_hours = event.detail.timeSlots.map((slot: TimeSlot) => {
      const { start_time, end_time } = slot;
      const openTime: any = {
        startHour: start_time.getHours(),
        startMinute: start_time.getMinutes(),
        endHour: end_time.getHours(),
        endMinute: end_time.getMinutes(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      if (_this.show_as_week || _this.show_weekends) {
        openTime.startWeekday = start_time.getDay();
        openTime.endWeekday = end_time.getDay();
      }
      return openTime;
    });
  }

  // niceDate: shows date rules in a nice string format; selectively includes weekday if _this.show_as_week /  _this.show_weekends are set
  function niceDate(block: AvailabilityRule) {
    let startMoment = new Date(
      0,
      0,
      0,
      block.startHour,
      block.startMinute,
    ).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    let endMoment = new Date(
      0,
      0,
      0,
      block.endHour,
      block.endMinute,
    ).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if ((_this.show_as_week || _this.show_weekends) && block.startWeekday) {
      let weekday = weekdays[block.startWeekday];
      return `${weekday}: ${startMoment} - ${endMoment}`;
    } else {
      return `${startMoment} - ${endMoment}`;
    }
  }
  // #endregion unpersisted variables

  let width = "60%";
  let gutterWidth = 35;
  $: width = showPreview ? "60%" : "100%";
  let adjustingPreviewPane: boolean = false;

  function adjustColumns(e: MouseEvent) {
    if (adjustingPreviewPane) {
      width = `${e.clientX - gutterWidth}px`;
    }
  }

  let debouncedInputTimer: number;
  function debounceEmailInput(e: HTMLInputElement, event) {
    const emailString = e.target.value;
    clearTimeout(debouncedInputTimer);
    debouncedInputTimer = setTimeout(() => {
      event.email_ids = parseStringToArray(emailString);
      _this.events = [..._this.events];
    }, 1000);
  }

  let slots_to_book: TimeSlot;
  let mainElementWidth: number;
  $: showPreview = mainElementWidth > 600;

  //#region custom fields
  const customFieldKeys = ["title", "description", "type", "required"];
  const emptyCustomField: CustomField = {
    title: "",
    description: "",
    type: "text",
    required: false,
  };

  let newFieldTitleElement: HTMLElement;
  let newCustomField: CustomField = { ...emptyCustomField };

  function removeCustomField(field: CustomField) {
    _this.custom_fields = _this.custom_fields.filter(
      (customField: CustomField) => customField !== field,
    );
  }

  function addNewField(field: CustomField) {
    _this.custom_fields = [..._this.custom_fields, field];
    newCustomField = { ...emptyCustomField };
    newFieldTitleElement.focus();
  }
  //#endregion custom fields

  //#region consecutive events

  function addConsecutiveEvent() {
    _this.events = [..._this.events, { ...eventTemplate }];
  }

  function removeConsecutiveEvent(event: EventDefinition) {
    _this.events = _this.events.filter((e) => e !== event);
  }

  //#endregion consecutive events
</script>

<style lang="scss">
  @import "./styles/schedule-editor.scss";
</style>

{#if manifest && manifest.error}
  <nylas-domain-error {id} />
{:else if initialized}
  <main
    style="grid-template-columns: {width} 5px auto"
    on:mousemove={adjustColumns}
    on:mouseup={() => (adjustingPreviewPane = false)}
    bind:clientWidth={mainElementWidth}
  >
    <div class="settings">
      <section class="basic-details">
        <h1>Event Details</h1>
        <p>
          Edit the details for your meeting. You can add consecutive meetings to
          allow users to book back-to-back events.
        </p>
        <div class="contents">
          {#each _this.events as event, iter}
            <fieldset>
              {#if _this.events.length > 1}
                <button
                  class="remove-event"
                  on:click={() => removeConsecutiveEvent(event)}
                >
                  Remove this event
                </button>
              {/if}
              <label>
                <strong>Event Title</strong>
                <input type="text" bind:value={event.event_title} />
              </label>
              <label>
                <strong>Event Description</strong>
                <input type="text" bind:value={event.event_description} />
              </label>
              <label>
                <strong>Event Location</strong>
                <input type="text" bind:value={event.event_location} />
              </label>
              <label>
                <strong>Conferencing Link (Zoom, Teams, or Meet URL)</strong>
                <input type="url" bind:value={event.event_conferencing} />
              </label>
              <div role="radiogroup" aria-labelledby="slot_size">
                <strong id="slot_size">Meeting Length</strong>
                <label>
                  <input type="radio" value={15} bind:group={event.slot_size} />
                  <span>15 minutes</span>
                </label>
                <label>
                  <input type="radio" value={30} bind:group={event.slot_size} />
                  <span>30 minutes</span>
                </label>
                <label>
                  <input type="radio" value={60} bind:group={event.slot_size} />
                  <span>60 minutes</span>
                </label>
                {#if iter !== 0 && event.slot_size !== _this.events[0].slot_size}
                  <!-- Temporary! Nylas' Consecutive Availabiilty API does not support variant time lengths between meetings -->
                  <!-- https://app.shortcut.com/nylas/story/74514/consecutive-availability-allow-to-specify-duration-minutes-per-meeting -->
                  <p class="warning">
                    Note: different meeting lengths in a conecutive chain are
                    not currently supported; all meetings in this chain will
                    fall back to {_this.events[0].slot_size} minutes.
                  </p>
                {/if}
              </div>
              <div>
                <div>
                  <strong id="email_ids"
                    >Email Ids to include for scheduling</strong
                  >
                </div>
                <label>
                  <textarea
                    name="email_ids"
                    on:input={(e) => debounceEmailInput(e, event)}
                    value={event.email_ids}
                  />
                </label>
              </div>
            </fieldset>
          {/each}
        </div>
        <button class="add-event" on:click={addConsecutiveEvent}
          >Add a follow-up event</button
        >
        <button on:click={saveProperties}>Save Editor Options</button>
      </section>
      <section class="time-date-details">
        <h1>Date/Time Details</h1>
        <div class="contents">
          <div>
            <label>
              <strong>Start Hour</strong>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                bind:value={_this.start_hour}
              />
            </label>
            {_this.start_hour}:00
          </div>
          <div>
            <label>
              <strong>End Hour</strong>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                bind:value={_this.end_hour}
              />
            </label>
            {_this.end_hour}:00
          </div>
          <label>
            <strong>Start Date</strong>
            <input type="date" bind:value={startDate} />
          </label>
          <label>
            <strong>Time Zone</strong>
            <select bind:value={_this.timezone}>
              {#each timezones.default as timezone}
                <option value={timezone.tzCode}>{timezone.name}</option>
              {/each}
            </select>
          </label>
          <div>
            <label>
              <strong>Days to show</strong>
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                bind:value={_this.dates_to_show}
              />
            </label>
            {_this.dates_to_show}
          </div>
          <div role="checkbox" aria-labelledby="show_as_week">
            <strong id="show_as_week">Show as week</strong>
            <label>
              <input
                type="checkbox"
                name="show_as_week"
                bind:checked={_this.show_as_week}
              />
              Show whole week
            </label>
          </div>
          <div role="checkbox" aria-labelledby="show_weekends">
            <strong id="show_weekends">Show weekends</strong>
            <label>
              <input
                type="checkbox"
                name="show_weekends"
                bind:checked={_this.show_weekends}
              />
              Keep weekends on
            </label>
          </div>
          <div class="available-hours">
            <strong>Available Hours</strong>
            <p>
              Drag over the hours want to be availble for booking. All other
              hours will always show up as "busy" to your users.
            </p>
            <div role="checkbox" aria-labelledby="show_as_week">
              <label>
                <input
                  type="checkbox"
                  name="_this.show_as_week"
                  bind:checked={_this.show_as_week}
                />
                Customize each weekday
              </label>
            </div>
            <div role="checkbox" aria-labelledby="show_as_week">
              <label>
                <input
                  type="checkbox"
                  name=" _this.show_weekends"
                  bind:checked={_this.show_weekends}
                />
                Allow booking on weekends
              </label>
            </div>
            <div class="availability-container">
              <nylas-availability
                allow_booking={true}
                max_bookable_slots={Infinity}
                show_as_week={_this.show_as_week || _this.show_weekends}
                show_weekends={_this.show_weekends}
                start_hour={_this.start_hour}
                end_hour={_this.end_hour}
                allow_date_change={false}
                partial_bookable_ratio="0"
                show_header={false}
                date_format={_this.show_as_week || _this.show_weekends
                  ? "weekday"
                  : "none"}
                busy_color="#000"
                closed_color="#999"
                selected_color="#095"
                slot_size="15"
                on:timeSlotChosen={availabilityChosen}
              />
            </div>
            <ul class="availability">
              {#each _this.open_hours || [] as availability}
                <li>
                  <span class="date">
                    {niceDate(availability)}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
        <button on:click={saveProperties}>Save Editor Options</button>
      </section>
      <section class="style-details">
        <h1>Style Details</h1>
        <div class="contents">
          <div role="checkbox" aria-labelledby="show_ticks">
            <strong id="show_ticks">Show ticks</strong>
            <label>
              <input
                type="checkbox"
                name="show_ticks"
                bind:checked={_this.show_ticks}
              />
              Show tick marks on left side
            </label>
          </div>
          <div role="radiogroup" aria-labelledby="view_as">
            <strong id="view_as">View as a Schedule, or as a List?</strong>
            <label>
              <input
                type="radio"
                name="view_as"
                bind:group={_this.view_as}
                value="schedule"
              />
              <span>Schedule</span>
            </label>
            <label>
              <input
                type="radio"
                name="view_as"
                bind:group={_this.view_as}
                value="list"
              />
              <span>List</span>
            </label>
          </div>
          <label>
            <strong>Attendees to show</strong>
            <input
              type="number"
              min={1}
              max={20}
              bind:value={_this.attendees_to_show}
            />
          </label>
        </div>
        <button on:click={saveProperties}>Save Editor Options</button>
      </section>
      <section class="booking-details">
        <h1>Booking Details</h1>
        <div class="contents">
          <div role="checkbox" aria-labelledby="allow_booking">
            <strong id="allow_booking">Allow booking</strong>
            <label>
              <input
                type="checkbox"
                name="allow_booking"
                bind:checked={_this.allow_booking}
              />
              Allow bookings to be made
            </label>
          </div>
          <label>
            <strong>Maximum slots that can be booked at once</strong>
            <input
              type="number"
              min={1}
              max={20}
              bind:value={_this.max_bookable_slots}
            />
          </label>
          <div role="checkbox" aria-labelledby="screen_bookings">
            <strong id="screen_bookings"
              >Scheduling on this calendar requires manual confirmation</strong
            >
            <label>
              <input
                type="checkbox"
                name="screen_bookings"
                bind:checked={_this.screen_bookings}
              />
              Let the meeting host screen bookings before they're made official
            </label>
          </div>
          <label>
            <strong>Participant Threshold / Partial bookable ratio</strong>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              bind:value={_this.partial_bookable_ratio}
            />
            {Math.floor(_this.partial_bookable_ratio * 100)}%
          </label>
          <div role="radiogroup" aria-labelledby="recurrence">
            <strong id="recurrence"
              >Allow, Disallow, or Mandate events to repeat?</strong
            >
            <label>
              <input
                type="radio"
                name="recurrence"
                bind:group={_this.recurrence}
                value="none"
              />
              <span>Don't Repeat Events</span>
            </label>
            <label>
              <input
                type="radio"
                name="recurrence"
                bind:group={_this.recurrence}
                value="optional"
              />
              <span>Users May Repeat Events</span>
            </label>
            <label>
              <input
                type="radio"
                name="recurrence"
                bind:group={_this.recurrence}
                value="required"
              />
              <span>Events Always Repeat</span>
            </label>
          </div>
          <label>
            <strong>Capacity</strong>
            <input type="number" min={1} bind:value={_this.capacity} />
          </label>
          <div role="checkbox" aria-labelledby="allow_booking">
            <strong>Top of the Hour Events</strong>
            <label>
              <input
                type="checkbox"
                name="mandate_top_of_hour"
                bind:checked={_this.mandate_top_of_hour}
              />
              Only allow events to be booked at the Top of the Hour
            </label>
          </div>
          {#if _this.recurrence === "required" || _this.recurrence === "optional"}
            <div role="radiogroup" aria-labelledby="recurrence_cadence">
              <strong id="recurrence_cadence"
                >How often should events repeat{#if _this.recurrence === "optional"},
                  if a user chooses to do so{/if}?</strong
              >
              <label>
                <input
                  type="checkbox"
                  name="recurrence_cadence"
                  bind:group={_this.recurrence_cadence}
                  value="daily"
                />
                <span>Daily</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="recurrence_cadence"
                  bind:group={_this.recurrence_cadence}
                  value="weekdays"
                />
                <span>Daily, only on weekdays</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="recurrence_cadence"
                  bind:group={_this.recurrence_cadence}
                  value="weekly"
                />
                <span>Weekly</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="recurrence_cadence"
                  bind:group={_this.recurrence_cadence}
                  value="biweekly"
                />
                <span>Biweekly</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="recurrence_cadence"
                  bind:group={_this.recurrence_cadence}
                  value="monthly"
                />
                <span>Monthly</span>
              </label>
            </div>
          {/if}
        </div>
        <button on:click={saveProperties}>Save Editor Options</button>
      </section>

      <section class="booking-details">
        <h1>Custom Fields</h1>
        <p class="intro">
          Ask users to fill out a few details before booking an event with you.
          By deafult, they will be asked for their name and email address.
        </p>
        <div class="contents">
          {#if _this.custom_fields}
            <table cellspacing="0" cellpadding="0">
              <thead>
                {#each customFieldKeys as key}
                  <th>{key}</th>
                {/each}
                <th />
              </thead>
              <tbody>
                {#each _this.custom_fields as field}
                  <tr>
                    {#each customFieldKeys as key}
                      <td>{field[key] || "—"}</td>
                    {/each}
                    <td
                      ><button on:click={() => removeCustomField(field)}
                        >Remove</button
                      ></td
                    >
                  </tr>
                {/each}
                <tr class="add-new">
                  <td>
                    <input
                      type="text"
                      placeholder="Title"
                      aria-label="Title"
                      bind:this={newFieldTitleElement}
                      bind:value={newCustomField.title}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Description"
                      aria-label="Description"
                      bind:value={newCustomField.description}
                    />
                  </td>
                  <td>
                    <select
                      bind:value={newCustomField.type}
                      aria-label="Input Type"
                    >
                      <option value="text">Text</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </td>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        aria-label="Required Field?"
                        bind:checked={newCustomField.required}
                      />
                      <span>Required</span>
                    </label>
                  </td>
                  <td>
                    <button
                      disabled={!newCustomField.title || !newCustomField.type}
                      on:click={() => addNewField(newCustomField)}
                      class="add-custom-field">Add Field</button
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          {/if}
        </div>
      </section>

      <section class="Notification-details">
        <h1>Notification Details</h1>
        <div class="contents">
          <div role="radiogroup" aria-labelledby="notification_mode">
            <strong id="notification_mode"
              >How would you like to notify the customer on event creation?</strong
            >
            <label>
              <input
                type="radio"
                name="notification_mode"
                value={NotificationMode.SHOW_MESSAGE}
                bind:group={_this.notification_mode}
              />
              <span>Show Message on UI</span>
            </label>
            <label>
              <input
                type="radio"
                name="notification_mode"
                value={NotificationMode.SEND_MESSAGE}
                bind:group={_this.notification_mode}
              />
              <span>Send message via email</span>
            </label>
          </div>
          <label>
            <strong>Notification message</strong>
            <input type="text" bind:value={_this.notification_message} />
          </label>
          <label>
            <strong>Notification Subject</strong>
            <input type="text" bind:value={_this.notification_subject} />
          </label>
        </div>
        <button on:click={saveProperties}>Save Editor Options</button>
      </section>
    </div>
    {#if showPreview}
      <span class="gutter" on:mousedown={() => (adjustingPreviewPane = true)} />
      <aside id="preview">
        <h1>Preview</h1>
        <nylas-availability
          {..._this}
          {..._this.events[0]}
          capacity={null}
          on:timeSlotChosen={(event) => {
            slots_to_book = event.detail.timeSlots;
          }}
          calendars={!_this.events[0]?.email_ids
            ? [
                {
                  availability: "busy",
                  timeslots: [],
                },
              ]
            : []}
          {id}
        />
        <nylas-scheduler
          {slots_to_book}
          {..._this}
          capacity={null}
          calendars={!_this.events[0]?.email_ids
            ? [
                {
                  availability: "busy",
                  timeslots: [],
                },
              ]
            : []}
          {id}
        />
      </aside>
    {/if}
  </main>
{/if}
