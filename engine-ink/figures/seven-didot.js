import { driveUp } from "../src/figure.js";

/* seven-didot: traced from seven-didot.png by tools/trace.mjs (--dark 0.45 --mid 0.45 --size 700 --clean 0 --frame --frame-size 700).
 * Dark areas are solid ink, middle tones are hatched, all in one ink. A still. Retrace rather than edit the masks. */
const sevenDidotArea = [-0.8500, 0.8500, -0.8500, 0.8500];
const SEVEN_DIDOT_SOLID = { area: sevenDidotArea, mask: "jg.jg.27la.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5m.du.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5l.dv.5k.dw.5k.dw.5k.dw.5k.dw.5k.dw.5k.dw.5k.dw.5k.dw.5j.dx.5j.dx.5j.dx.5j.dx.5j.dx.5j.dx.5j.dx.5j.dx.5i.dy.5i.dy.1j.3r.8.dy.1b.3z.8.dy.17.43.8.dy.14.46.8.dy.11.48.9.dy.z.4a.8.dz.x.4c.8.dz.v.4e.8.dz.t.4g.8.dz.s.4h.8.dz.r.4i.8.dz.q.4i.8.e0.o.4k.8.e0.o.4k.8.e0.n.4l.8.e0.m.4m.8.e0.l.4n.8.e0.k.4n.8.e1.k.4n.8.e1.j.4o.8.e1.i.4p.8.e1.h.4q.8.e1.h.4q.8.e1.g.4q.8.e2.g.4q.8.e2.f.4r.8.e2.e.4s.8.e2.e.4s.8.e2.d.4s.8.e3.d.4s.8.e3.c.4t.8.e3.c.4t.8.e3.b.4u.8.e3.b.4t.8.e4.b.4t.8.e4.a.4u.8.e4.a.4u.8.e4.a.4u.8.e4.9.4u.8.e5.9.4u.8.e5.9.4u.8.e5.9.4u.8.e5.8.4u.8.e6.8.4u.8.e6.8.4u.8.e6.8.4u.8.e6.7.4u.9.e6.7.4u.8.e7.7.4u.8.e7.7.4u.8.e7.7.4t.9.e7.6.4u.8.e8.6.4u.8.e8.6.4u.8.e8.6.4t.9.j7.8.j8.8.j8.8.j7.9.j7.8.j8.8.j8.8.j7.9.j7.8.j8.8.j7.9.j7.9.j7.8.j8.8.j7.9.j7.9.j7.8.j7.9.j7.9.j7.9.j6.9.j7.9.j7.9.j7.9.j6.9.j7.9.j7.9.j6.a.j6.9.j7.9.j6.a.j6.9.j7.9.j6.a.j6.a.j6.9.j6.a.j6.a.j6.9.j6.a.j6.a.j6.a.j5.a.j6.a.j6.a.j5.b.j5.a.j5.b.j5.b.j5.a.j5.b.j5.b.j5.a.j5.b.j5.b.j4.c.j4.b.j5.b.j4.c.j4.b.j4.c.j4.c.j4.b.j4.c.j4.c.j3.c.j4.c.j4.c.j3.c.j4.c.j3.d.j3.d.j2.d.j3.d.j3.d.j2.d.j3.d.j2.e.j2.d.j2.e.j2.e.j2.d.j2.e.j2.e.j1.e.j2.e.j1.f.j1.e.j1.f.j1.f.j0.f.j1.f.j0.f.j1.f.j0.g.j0.f.j1.f.j0.g.j0.f.j0.g.j0.g.iz.g.j0.g.iz.h.iz.g.iz.h.iz.h.iy.h.iz.h.iy.h.iz.h.iy.i.iy.h.iy.i.iy.i.ix.i.iy.i.ix.j.iw.j.ix.j.iw.j.ix.j.iw.k.iw.j.iw.k.iw.j.iw.k.iw.k.iv.k.iw.k.iv.k.iw.k.iv.l.iv.k.iv.l.iu.l.iv.l.iu.m.iu.l.iu.m.it.m.iu.m.it.n.it.m.it.n.it.m.it.n.is.n.it.n.is.o.ir.o.is.o.ir.o.ir.p.ir.o.ir.p.iq.q.iq.p.iq.q.ip.q.iq.q.ip.q.ip.r.ip.r.io.r.io.s.io.r.io.s.in.s.in.t.in.s.in.t.im.u.il.u.im.u.il.u.il.v.ik.v.ik.w.ik.v.ik.w.ij.x.ii.x.ii.y.ii.x.ii.y.ih.y.ih.z.ig.z.ig.10.ig.z.ig.10.if.10.if.11.ie.11.ie.12.id.12.ie.12.id.13.ic.13.ic.14.ib.14.ib.15.ia.15.ia.16.i9.16.i9.17.i8.17.i8.18.i8.17.i8.18.i7.18.i7.19.i6.19.i6.1a.i5.1a.i5.1b.i4.1b.i4.1c.i3.1c.i3.1d.i2.1d.i2.1e.i1.1e.i1.1f.i0.1f.i0.1g.hz.1g.hz.1g.hz.1h.hy.1h.hy.1i.hx.1i.hx.1j.hw.1j.hw.1k.hv.1k.hv.1l.hu.1l.hu.1l.hu.1m.ht.1m.ht.1n.hs.1n.hs.1o.hr.1o.hq.1p.hq.1q.hp.1q.hp.1q.hq.1q.hp.1q.hp.1r.hp.1q.hp.1q.hq.1q.hp.1q.hq.1p.hr.1o.hs.1o.hr.1o.hs.1n.ht.1n.ht.1m.hu.1l.hv.1k.hw.1j.hx.1i.hz.1h.hz.1g.i1.1e.i2.1d.i4.1a.i7.18.i9.16.ib.14.ie.10.ii.x.il.t.iq.n.iw.e.2nd8" };

export const sevenDidot = {
  T: 4, active: [0, 1], S: 300, hint: "seven didot",
  drive: driveUp,
  shapes: [
    { id: "ink", ink: "black", bitmap: SEVEN_DIDOT_SOLID },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
