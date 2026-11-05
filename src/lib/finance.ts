export type RepaymentMethod = "annuity" | "linear";
export type LoanRate = { annualRateBps: number; effectiveOn: string };

export type LoanProjection = {
  monthlyPaymentMinor: bigint;
  payoffMonths: number | null;
  totalInterestMinor: bigint;
  remainingBalanceMinor: bigint;
};

const DAYS_PER_YEAR = BigInt(365);
const RATE_SCALE = BigInt(10_000);
const MAX_MINOR_UNITS = BigInt("9223372036854775807");
const MAX_PROJECTION_MONTHS = 1_200;

export function parseMoneyToMinor(value: string): bigint | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length > 20) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const amountMinor = whole * BigInt(100) + fraction;
  return amountMinor <= MAX_MINOR_UNITS ? amountMinor : null;
}

export function formatMinorAsMoney(amountMinor: bigint): string {
  const negative = amountMinor < BigInt(0);
  const absolute = negative ? -amountMinor : amountMinor;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole},${fraction}`;
}

export function parseAnnualRateToBps(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length > 7) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const basisPoints = BigInt(match[1]) * BigInt(100) +
    BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  if (basisPoints > BigInt(100_000)) return null;
  return Number(basisPoints);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < BigInt(0) || denominator <= BigInt(0)) {
    throw new RangeError("Rounding expects a nonnegative amount and positive divisor.");
  }
  return (numerator + denominator / BigInt(2)) / denominator;
}

function utcDay(date: string): number {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError("Expected a valid ISO calendar date.");
  }
  return parsed.getTime() / 86_400_000;
}

function nextMonthlyDate(fromDate: string, paymentDay: number, monthsAhead: number): string {
  const year = Number(fromDate.slice(0, 4));
  const month = Number(fromDate.slice(5, 7)) - 1;
  const day = Number(fromDate.slice(8, 10));
  const firstDueIsThisMonth = day < paymentDay;
  let targetMonth = month + monthsAhead - (firstDueIsThisMonth ? 1 : 0);
  let targetYear = year + Math.floor(targetMonth / 12);
  targetMonth %= 12;
  if (targetMonth < 0) {
    targetYear -= 1;
    targetMonth += 12;
  }
  const targetDay = Math.min(paymentDay, new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate());
  return `${targetYear.toString().padStart(4, "0")}-${(targetMonth + 1).toString().padStart(2, "0")}-${targetDay.toString().padStart(2, "0")}`;
}

export function accruedInterestMinor(
  principalMinor: bigint,
  rates: LoanRate[],
  fromDate: string,
  toDate: string,
): bigint {
  if (principalMinor < BigInt(0)) throw new RangeError("Principal cannot be negative.");
  const fromDay = utcDay(fromDate);
  const toDay = utcDay(toDate);
  if (toDay < fromDay) throw new RangeError("Interest end date precedes start date.");
  if (toDay === fromDay || principalMinor === BigInt(0)) return BigInt(0);

  const orderedRates = [...rates]
    .filter((rate) => utcDay(rate.effectiveOn) <= fromDay)
    .sort((left, right) => left.effectiveOn.localeCompare(right.effectiveOn));
  const activeRate = orderedRates.at(-1);
  if (!activeRate) throw new RangeError("No loan rate is effective at the start date.");

  const changes = rates
    .filter((rate) => rate.effectiveOn > fromDate && rate.effectiveOn < toDate)
    .sort((left, right) => left.effectiveOn.localeCompare(right.effectiveOn));
  let cursorDay = fromDay;
  let currentRate = activeRate.annualRateBps;
  let numerator = BigInt(0);

  for (const change of changes) {
    const changeDay = utcDay(change.effectiveOn);
    numerator += principalMinor * BigInt(currentRate) * BigInt(changeDay - cursorDay);
    cursorDay = changeDay;
    currentRate = change.annualRateBps;
  }
  numerator += principalMinor * BigInt(currentRate) * BigInt(toDay - cursorDay);
  return roundHalfUp(numerator, RATE_SCALE * DAYS_PER_YEAR);
}

function projectedInterestMinor(
  balanceMinor: bigint,
  annualRateBps: number,
  fromDate: string,
  toDate: string,
): bigint {
  const days = utcDay(toDate) - utcDay(fromDate);
  return roundHalfUp(
    balanceMinor * BigInt(annualRateBps) * BigInt(days),
    RATE_SCALE * DAYS_PER_YEAR,
  );
}

function buildProjection(
  principalMinor: bigint,
  annualRateBps: number,
  fromDate: string,
  paymentDay: number,
  method: RepaymentMethod,
  paymentMinor: bigint,
  maxMonths: number,
): LoanProjection {
  let balance = principalMinor;
  let totalInterest = BigInt(0);
  let previousDate = fromDate;
  let firstPayment = BigInt(0);
  let monthsElapsed = 0;

  for (let month = 1; month <= maxMonths && balance > BigInt(0); month += 1) {
    const dueDate = nextMonthlyDate(fromDate, paymentDay, month);
    const interest = projectedInterestMinor(balance, annualRateBps, previousDate, dueDate);
    const scheduledPayment = method === "linear"
      ? (paymentMinor < balance ? paymentMinor : balance) + interest
      : paymentMinor;
    if (month === 1) firstPayment = scheduledPayment < balance + interest
      ? scheduledPayment : balance + interest;
    if (method === "annuity" && scheduledPayment <= interest) {
      totalInterest += interest;
      balance += interest - scheduledPayment;
      previousDate = dueDate;
      monthsElapsed = month;
      continue;
    }
    const actualPayment = scheduledPayment < balance + interest
      ? scheduledPayment
      : balance + interest;
    const principalPaid = actualPayment - interest;
    balance -= principalPaid;
    totalInterest += interest;
    previousDate = dueDate;
    monthsElapsed = month;
  }

  return {
    monthlyPaymentMinor: firstPayment,
    payoffMonths: balance === BigInt(0) ? monthsElapsed : null,
    totalInterestMinor: totalInterest,
    remainingBalanceMinor: balance,
  };
}

function annuityPaymentMinor(
  principalMinor: bigint,
  annualRateBps: number,
  fromDate: string,
  paymentDay: number,
  termMonths: number,
): bigint {
  let low = BigInt(1);
  let high = principalMinor;
  while (buildProjection(
    principalMinor,
    annualRateBps,
    fromDate,
    paymentDay,
    "annuity",
    high,
    termMonths,
  ).remainingBalanceMinor > BigInt(0)) {
    high *= BigInt(2);
  }

  while (low < high) {
    const middle = (low + high) / BigInt(2);
    const remaining = buildProjection(
      principalMinor,
      annualRateBps,
      fromDate,
      paymentDay,
      "annuity",
      middle,
      termMonths,
    ).remainingBalanceMinor;
    if (remaining === BigInt(0)) high = middle;
    else low = middle + BigInt(1);
  }
  return low;
}

export function projectLoanAtRate(input: {
  principalMinor: bigint;
  annualRateBps: number;
  fromDate: string;
  paymentDay: number;
  remainingMonths: number;
  repaymentMethod: RepaymentMethod;
  currentPaymentMinor?: bigint;
}): { recalculated: LoanProjection; fixedPayment: LoanProjection } {
  const {
    principalMinor,
    annualRateBps,
    fromDate,
    paymentDay,
    remainingMonths,
    repaymentMethod,
  } = input;
  if (principalMinor <= BigInt(0) || !Number.isInteger(annualRateBps) ||
    annualRateBps < 0 || annualRateBps > 100_000 ||
    !Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28 ||
    !Number.isInteger(remainingMonths) || remainingMonths < 1 ||
    remainingMonths > MAX_PROJECTION_MONTHS) {
    throw new RangeError("Invalid loan projection inputs.");
  }
  utcDay(fromDate);

  const recalculatedPayment = repaymentMethod === "annuity"
    ? annuityPaymentMinor(principalMinor, annualRateBps, fromDate, paymentDay, remainingMonths)
    : (principalMinor + BigInt(remainingMonths) - BigInt(1)) / BigInt(remainingMonths);
  const recalculated = buildProjection(
    principalMinor,
    annualRateBps,
    fromDate,
    paymentDay,
    repaymentMethod,
    recalculatedPayment,
    remainingMonths,
  );

  const fixedPaymentMinor = input.currentPaymentMinor ?? recalculated.monthlyPaymentMinor;
  if (fixedPaymentMinor <= BigInt(0)) throw new RangeError("Payment must be positive.");
  const fixedPayment = buildProjection(
    principalMinor,
    annualRateBps,
    fromDate,
    paymentDay,
    "annuity",
    fixedPaymentMinor,
    MAX_PROJECTION_MONTHS,
  );
  return { recalculated, fixedPayment };
}

export function remainingTermMonths(
  termMonths: number,
  startDate: string,
  paymentDay: number,
  today: string,
): number {
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > MAX_PROJECTION_MONTHS ||
    !Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28 ||
    utcDay(today) < utcDay(startDate)) {
    throw new RangeError("Invalid loan term.");
  }
  // Count scheduled dates, not payments: extra or missed payments must not move maturity.
  let elapsed = 0;
  while (elapsed < termMonths && nextMonthlyDate(startDate, paymentDay, elapsed + 1) <= today) {
    elapsed += 1;
  }
  return Math.max(1, termMonths - elapsed);
}
