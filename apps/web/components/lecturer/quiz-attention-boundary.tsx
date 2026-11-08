"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };

export class QuizAttentionBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[LecturerQuizAttention]", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
