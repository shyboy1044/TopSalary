/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, IS_BROWSER, useRef } from "$fresh/runtime.ts";
import { apply, tw } from "$twind";
import { animation, css } from "$twind/css";
import useSWR from "$swr";
import { graphql } from "@/utils/shopify.ts";

// Lazy load a <dialog> polyfill.
// @ts-expect-error HTMLDialogElement is not just a type!
if (IS_BROWSER && window.HTMLDialogElement === "undefined") {
  await import(
    "https://raw.githubusercontent.com/GoogleChrome/dialog-polyfill/5033aac1b74c44f36cde47be3d11f4756f3f8fda/dist/dialog-polyfill.esm.js"
  );
}

declare global {
  interface HTMLDialogElement {
    showModal(): void;
    close(): void;
  }
}

const slideRight = animation("0.4s ease normal", {
  from: { transform: "translateX(100%)" },
  to: { transform: "translateX(0)" },
});

const slideBottom = animation("0.4s ease normal", {
  from: { transform: "translateY(100%)" },
  to: { transform: "translateY(0)" },
});

const backdrop = css({
  "&::backdrop": {
    background: "rgba(0, 0, 0, 0.5)",
  },
});

interface CartData {
  id: string;
  lines: {
    edges: {
      node: {
        id: string;
        quantity: number;
        merchandise: {
          title: string;
        };
        estimatedCost: {
          totalAmount: {
            amount: number;
            currencyCode: string;
          };
        };
      };
    }[];
  };
  estimatedCost: {
    totalAmount: {
      amount: number;
      currencyCode: string;
    };
  };
}

const CART_QUERY = `{
  id
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ...on ProductVariant {
            title
          }
        }
        estimatedCost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
  estimatedCost {
    totalAmount {
      amount
      currencyCode
    }
  }
}`;

async function cartFetcher(): Promise<CartData> {
  const id = localStorage.getItem("cartId");
  if (id === null) {
    const { cartCreate } = await graphql(
      `mutation { cartCreate { cart ${CART_QUERY} } }`,
    );
    localStorage.setItem("cartId", cartCreate.cart.id);
    return cartCreate.cart;
  }

  const { cart } = await graphql(
    `query($id: ID!) { cart(id: $id) ${CART_QUERY} }`,
    { id },
  );

  return cart;
}

export default function Cart() {
  const { data, error } = useSWR<CartData, Error>("cart", cartFetcher, {});
  console.log(data, error);

  const ref = useRef<HTMLDialogElement | null>(null);

  const onDialogClick = (e: MouseEvent) => {
    if ((e.target as HTMLDialogElement).tagName === "DIALOG") {
      ref.current!.close();
    }
  };

  return (
    <div>
      <button onClick={() => ref.current!.showModal()}>
        Cart ({data?.lines.edges.length})
      </button>
      <dialog
        ref={ref}
        class={tw
          `bg-transparent p-0 m-0 pt-[50%] sm:pt-0 sm:ml-auto max-w-full sm:max-w-lg w-full max-h-full h-full ${slideBottom} sm:${slideRight} ${backdrop}`}
        onClick={onDialogClick}
      >
        <CartInner cart={data} />
      </dialog>
    </div>
  );
}

function CartInner(props: { cart: CartData | undefined }) {
  const corners = apply`rounded(tl-2xl tr-2xl sm:(tr-none bl-2xl))`;
  const card = tw
    `py-8 px-6 h-full bg-white ${corners} flex flex-col justify-between`;

  return (
    <div class={card}>
      <div class={tw`flex justify-between`}>
        <h1 class={tw`text-4xl font-bold m-0`}>Cart</h1>
        <button
          class={tw`py-1`}
          onClick={(e) => {
            (e.target as HTMLButtonElement).closest("dialog")!.close();
          }}
        >
          <svg
            class={tw`w-6 h-6 fill-current text-gray-600`}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
      {props.cart && (
        <div class={tw`flex-grow-1 my-4`}>
          {props.cart.lines.edges.length === 0
            ? <p class={tw`text-gray-700`}>There are no items in the cart.</p>
            : (
              <ul>
                {props.cart.lines.edges.map((line) => (
                  <li>
                    {line.node.merchandise.title} x{line.node.quantity}{" "}
                    ({formatCurrency(line.node.estimatedCost.totalAmount)})
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
      {props.cart && (
        <div class={tw`my-4`}>
          TOTAL: {formatCurrency(props.cart.estimatedCost.totalAmount)}
        </div>
      )}
      <a
        class={tw
          `block p-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-default`}
        disabled
      >
        Checkout
      </a>
    </div>
  );
}

function formatCurrency(amount: { amount: number; currencyCode: string }) {
  const intl = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: amount.currencyCode,
  });
  return intl.format(amount.amount);
}
